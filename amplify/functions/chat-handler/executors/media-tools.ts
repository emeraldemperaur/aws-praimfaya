import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { ToolExecutionContext } from "./types";

function getMediaBucketName(env: Record<string, string>): string {
    return env.MEDIA_OUTPUT_BUCKET_NAME || env.MEDIA_OUTPUT_BUCKET || "praimfaya-media-outputs";
}

async function recordRAGArtifact(
    profile: any,
    session: { userId: string; id: string; title?: string },
    fileUrl: string,
    fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
    dynamodb: any,
    ragArtifactsTable?: string
) {
    if (!ragArtifactsTable || !dynamodb) return;

    const fileName = fileUrl.split('/').pop() || 'artifact';
    try {
        await dynamodb.send(new PutCommand({
            TableName: ragArtifactsTable,
            Item: {
                id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId: session.userId,
                terminalId: session.id,
                terminalTitle: session.title || profile?.name || 'Terminal Session',
                modelName: profile?.llmModelId || 'amazon.nova-pro-v1:0',
                contextProfileName: profile?.name || 'Vanguard AI',
                fileUrl: fileUrl,
                fileName: fileName,
                fileType: fileType,
                createdAt: new Date().toISOString()
            }
        }));
    } catch (err) {
        console.error("Failed to record RAG artifact telemetry:", err);
    }
}

async function processAndUploadImageOutput(
    bytes: Uint8Array, 
    family: string, 
    s3Client: any, 
    bucketName: string
) {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    const b64 = body.images?.[0] || body.base64;
    
    if (!b64) throw new Error("No base64 image data returned from model response.");

    const fileName = `image-renders/${family}-${Date.now()}.jpeg`;
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: Buffer.from(b64, "base64"),
        ContentType: "image/jpeg"
    }));

    return { 
        status: "Success", 
        imageUrl: `https://${bucketName}.s3.amazonaws.com/${fileName}` 
    };
}

export const executeAudioGenerator = async ({
    toolInput,
    citations,
    clients,
    profile,
    cognitoUserId,
    sessionId,
    env
}: ToolExecutionContext) => {
    try {
        const bucketName = getMediaBucketName(env);
        const voiceId = toolInput.voiceId || "Matthew";
        
        if (!toolInput.text) return { error: "Text parameter is required for audio generation." };

        const pollyRes = await clients.polly.send(new SynthesizeSpeechCommand({
            Engine: "generative",
            OutputFormat: "mp3",
            Text: toolInput.text,
            VoiceId: voiceId
        }));

        const audioBytes = await pollyRes.AudioStream?.transformToByteArray();
        if (!audioBytes) throw new Error("Failed to read audio stream from Polly response.");

        const fileName = `audio-renders/${Date.now()}.mp3`;
        await clients.s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: Buffer.from(audioBytes),
            ContentType: "audio/mpeg"
        }));

        const audioUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
        
        await recordRAGArtifact(
            profile,
            { userId: cognitoUserId, id: sessionId, title: profile?.name },
            audioUrl,
            'AUDIO',
            clients.dynamodb,
            env.RAG_ARTIFACTS_TABLE_NAME
        );

        citations.push({ type: 'asset', uri: audioUrl });

        return { 
            status: "Success", 
            audioUrl,
            billingMetrics: { action: "GENERATE_AUDIO", creditsToDeduct: 500 }
        };
    } catch (err: any) {
        console.error("Polly Audio Generation Error:", err);
        return { error: `Audio Generation Failed: ${err.message}` };
    }
};

export const executeImageGenerator = async ({
    toolInput,
    citations,
    clients,
    profile,
    cognitoUserId,
    sessionId,
    env,
    toolName 
}: ToolExecutionContext & { toolName: string }) => {
    try {
        const bucketName = getMediaBucketName(env);
        let modelId = "stability.sd3-5-large-v1:0";
        let reqBody: any;
        let creditsToCharge = 30000;

        if (toolName === 'generate_image') {
            if (!toolInput.prompt) return { error: "Prompt parameter is required for image generation." };
            modelId = "stability.sd3-5-large-v1:0";
            reqBody = { prompt: toolInput.prompt, output_format: "jpeg" };
            creditsToCharge = 30000;
        } 
        else if (toolName === 'edit_image') {
            modelId = "amazon.nova-canvas-v1:0";
            creditsToCharge = 15000;
            const { s3Uri, taskType = "BACKGROUND_REMOVAL", prompt, maskPrompt } = toolInput;

            if (s3Uri && s3Uri.startsWith('s3://')) {
                const uriParts = s3Uri.replace('s3://', '').split('/');
                const srcBucket = uriParts.shift()!;
                const srcKey = uriParts.join('/');

                const s3Res = await clients.s3.send(new GetObjectCommand({ Bucket: srcBucket, Key: srcKey }));
                const byteArr = await s3Res.Body?.transformToByteArray();
                if (!byteArr) throw new Error("Failed to read source image from S3 for editing.");

                const base64Image = Buffer.from(byteArr).toString('base64');
                reqBody = { taskType };

                if (taskType === "BACKGROUND_REMOVAL") {
                    reqBody.backgroundRemovalParams = { image: base64Image };
                } else if (taskType === "INPAINTING") {
                    reqBody.inPaintingParams = {
                        image: base64Image,
                        text: prompt || "remove object",
                        maskPrompt: maskPrompt || "main subject"
                    };
                } else if (taskType === "OUTPAINTING") {
                    reqBody.outPaintingParams = {
                        image: base64Image,
                        text: prompt || "extend background",
                        outPaintingMode: "DEFAULT"
                    };
                } else if (taskType === "IMAGE_VARIATION") {
                    reqBody.imageVariationParams = {
                        images: [base64Image],
                        text: prompt || "create variation"
                    };
                }
            } else {
                if (!toolInput.prompt) return { error: "Prompt or s3Uri parameter is required for image editing." };
                reqBody = {
                    taskType: "TEXT_IMAGE",
                    textToImageParams: { text: toolInput.prompt },
                    imageGenerationConfig: { numberOfImages: 1, height: 1024, width: 1024 }
                };
            }
        } 
        else {
            if (!toolInput.prompt) return { error: "Prompt parameter is required for enterprise image generation." };
            modelId = "amazon.titan-image-generator-v2:0";
            creditsToCharge = 4000;
            reqBody = {
                taskType: "TEXT_IMAGE",
                textToImageParams: { text: toolInput.prompt },
                imageGenerationConfig: { numberOfImages: 1, height: 1024, width: 1024 }
            };
        }

        const invokeRes = await clients.bedrockRuntime.send(new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(reqBody)
        }));

        const result = await processAndUploadImageOutput(invokeRes.body, toolName, clients.s3, bucketName);
        
        if (result.imageUrl) {
            await recordRAGArtifact(
                profile,
                { userId: cognitoUserId, id: sessionId, title: profile?.name },
                result.imageUrl,
                'IMAGE',
                clients.dynamodb,
                env.RAG_ARTIFACTS_TABLE_NAME
            );
            citations.push({ type: 'media', uri: result.imageUrl });
        }

        return {
            ...result,
            billingMetrics: { action: toolName.toUpperCase(), creditsToDeduct: creditsToCharge }
        };
    } catch (err: any) {
        console.error("Bedrock Image Generation Error:", err);
        return { error: `Image Generation Failed: ${err.message}` };
    }
};

export const executeLumaVideo = async ({
    toolInput,
    citations,
    clients,
    profile,
    cognitoUserId,
    sessionId,
    env
}: ToolExecutionContext) => {
    try {
        const bucketName = getMediaBucketName(env);
        const { 
            action = 'GENERATE_VIDEO', 
            prompt, 
            aspectRatio, 
            s3Uri, 
            voiceoverText, 
            voiceId = "Matthew", 
            videoUrl, 
            audioUrl 
        } = toolInput;

        if (action === 'BLEND_AUDIO_VIDEO') {
            if (!videoUrl || !audioUrl) {
                return { error: "videoUrl and audioUrl are required for blending." };
            }

            let vPath = "", aPath = "", outPath = "";
            try {
                const vUrlObj = new URL(videoUrl);
                const vKey = decodeURIComponent(vUrlObj.pathname.substring(1));
                const aUrlObj = new URL(audioUrl);
                const aKey = decodeURIComponent(aUrlObj.pathname.substring(1));

                const vRes = await clients.s3.send(new GetObjectCommand({ Bucket: bucketName, Key: vKey }));
                const aRes = await clients.s3.send(new GetObjectCommand({ Bucket: bucketName, Key: aKey }));

                const vBytes = await vRes.Body?.transformToByteArray();
                const aBytes = await aRes.Body?.transformToByteArray();

                if (!vBytes || !aBytes) throw new Error("Failed to read source streams from S3.");

                const runId = Date.now();
                vPath = path.join('/tmp', `v_${runId}.mp4`);
                aPath = path.join('/tmp', `a_${runId}.mp3`);
                outPath = path.join('/tmp', `out_${runId}.mp4`);

                fs.writeFileSync(vPath, vBytes);
                fs.writeFileSync(aPath, aBytes);

                execSync(`ffmpeg -y -i ${vPath} -i ${aPath} -c:v copy -c:a aac -shortest ${outPath}`);

                const outBytes = fs.readFileSync(outPath);
                const blendedKey = `video-renders/blended-${runId}.mp4`;

                await clients.s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: blendedKey,
                    Body: outBytes,
                    ContentType: "video/mp4"
                }));

                const blendedUrl = `https://${bucketName}.s3.amazonaws.com/${blendedKey}`;

                await recordRAGArtifact(
                    profile,
                    { userId: cognitoUserId, id: sessionId, title: profile?.name },
                    blendedUrl,
                    'VIDEO',
                    clients.dynamodb,
                    env.RAG_ARTIFACTS_TABLE_NAME
                );

                citations.push({ type: 'media', uri: blendedUrl });

                return {
                    status: "Success",
                    message: "Audio and Video streams have been successfully blended into a single downloadable .mp4 file.",
                    blendedUrl: blendedUrl,
                    billingMetrics: { action: "BLEND_AUDIO_VIDEO", creditsToDeduct: 250 }
                };

            } finally {
                if (vPath && fs.existsSync(vPath)) fs.unlinkSync(vPath);
                if (aPath && fs.existsSync(aPath)) fs.unlinkSync(aPath);
                if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
            }
        }

  
        if (!prompt && !s3Uri) {
            return { error: "A prompt or source image (s3Uri) is required for video generation." };
        }

        let creditsToCharge = 150000;
        let pollyAudioUrl: string | undefined;

        if (voiceoverText) {
            const pollyRes = await clients.polly.send(new SynthesizeSpeechCommand({
                Engine: "generative",
                OutputFormat: "mp3",
                Text: voiceoverText,
                VoiceId: voiceId
            }));

            const audioBytes = await pollyRes.AudioStream?.transformToByteArray();
            if (audioBytes) {
                const audioFileName = `audio-renders/luma-voiceover-${Date.now()}.mp3`;
                await clients.s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: audioFileName,
                    Body: Buffer.from(audioBytes),
                    ContentType: "audio/mpeg"
                }));
                
                pollyAudioUrl = `https://${bucketName}.s3.amazonaws.com/${audioFileName}`;
                
                await recordRAGArtifact(
                    profile,
                    { userId: cognitoUserId, id: sessionId, title: profile?.name },
                    pollyAudioUrl,
                    'AUDIO',
                    clients.dynamodb,
                    env.RAG_ARTIFACTS_TABLE_NAME
                );
                creditsToCharge += 500;
            }
        }

        let modelInput: any = { aspect_ratio: aspectRatio || '16:9' };
        if (prompt) modelInput.prompt = prompt;
        
        if (s3Uri && s3Uri.startsWith('s3://')) {
            const uriParts = s3Uri.replace('s3://', '').split('/');
            const srcBucket = uriParts.shift()!;
            const srcKey = uriParts.join('/');

            const s3Res = await clients.s3.send(new GetObjectCommand({ Bucket: srcBucket, Key: srcKey }));
            const byteArr = await s3Res.Body?.transformToByteArray();
            if (!byteArr) throw new Error("Failed to read source image from S3 for Luma video generation.");

            const base64Image = Buffer.from(byteArr).toString('base64');
            const mimeType = srcKey.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            modelInput.keyframes = { frame0: { type: "image", url: `data:${mimeType};base64,${base64Image}` } };
        }

        const videoKeyPrefix = `video-renders/luma-${Date.now()}`;
        
        const asyncJob = await clients.bedrockRuntime.send(new StartAsyncInvokeCommand({
            modelId: "luma.ray-v2:0",
            modelInput: modelInput,
            outputDataConfig: {
                s3OutputDataConfig: { s3Uri: `s3://${bucketName}/${videoKeyPrefix}` }
            }
        }));

        const silentVideoUrl = `https://${bucketName}.s3.amazonaws.com/${videoKeyPrefix}/output.mp4`;

        await recordRAGArtifact(
            profile,
            { userId: cognitoUserId, id: sessionId, title: profile?.name },
            silentVideoUrl,
            'VIDEO',
            clients.dynamodb,
            env.RAG_ARTIFACTS_TABLE_NAME
        );

        citations.push({ type: 'media', uri: silentVideoUrl });

        return {
            status: "Success",
            message: pollyAudioUrl 
                ? "Generation started. The video is rendering silently in the background, and the voiceover has been prepared. Trigger BLEND_AUDIO_VIDEO once Bedrock finishes the video."
                : "Video generation job submitted successfully.",
            videoUrl: silentVideoUrl,
            audioUrl: pollyAudioUrl,
            jobArn: asyncJob.invocationArn,
            billingMetrics: { action: "GENERATE_LUMA_VIDEO", creditsToDeduct: creditsToCharge },
            uiDirective: pollyAudioUrl ? "AWAIT_AND_BLEND" : "POLL_BEDROCK_STATUS" 
        };

    } catch (err: any) {
        console.error("Luma Video Generation Error:", err);
        return { error: `Luma Video Error: ${err.message}` };
    }
};

export const executeLongFormVideoCompiler = async ({
    toolInput,
    profile,
    cognitoUserId,
    sessionId,
    env
}: ToolExecutionContext) => {
    try {
        const { topic, durationMinutes = 5, style = "cinematic", voiceId = "Matthew" } = toolInput;
        
        const safeDuration = Math.min(Number(durationMinutes), 30);
        const totalClips = Math.ceil((safeDuration * 60) / 5);
        const creditsToCharge = (totalClips * 150000) + 10000;

        const sfnClient = new SFNClient({ region: env.AWS_REGION || 'us-east-1' });
        const executionName = `vanguard-lfv-${cognitoUserId.substring(0, 8)}-${Date.now()}`;
        
        const payload = {
            userId: cognitoUserId,
            sessionId: sessionId,
            topic: topic,
            targetDurationMinutes: safeDuration,
            totalClipsToGenerate: totalClips,
            style: style,
            voiceId: voiceId,
            outputBucket: getMediaBucketName(env),
            ragArtifactsTable: env.RAG_ARTIFACTS_TABLE_NAME
        };

        const res = await sfnClient.send(new StartExecutionCommand({
            stateMachineArn: env.LONG_FORM_VIDEO_STATE_MACHINE_ARN,
            name: executionName,
            input: JSON.stringify(payload)
        }));

        return {
            status: "Success",
            message: `Long-form video compilation job (${safeDuration} minutes) dispatched. The AI is writing the script, synthesizing ${totalClips} visual scenes in parallel via Luma Ray-v2, and generating the master voiceover. This will take up to an hour. You will be notified via SNS upon completion.`,
            executionArn: res.executionArn,
            estimatedClips: totalClips,
            billingMetrics: { action: "GENERATE_LONG_FORM_VIDEO", creditsToDeduct: creditsToCharge },
            uiDirective: "RENDER_ASYNC_JOB_TRACKER"
        };
    } catch (err: any) {
        console.error("Long Form Video Dispatch Error:", err);
        return { error: `Failed to dispatch long-form video engine: ${err.message}` };
    }
};