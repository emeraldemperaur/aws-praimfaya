import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ToolExecutionContext } from "./types";

function getMediaBucketName(env: Record<string, string>): string {
    const bucket = env.MEDIA_OUTPUT_BUCKET_NAME || env.MEDIA_OUTPUT_BUCKET || "praimfaya-media-outputs";
    return bucket;
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

        return { status: "Success", audioUrl };
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

        if (toolName === 'generate_image') {
            if (!toolInput.prompt) return { error: "Prompt parameter is required for image generation." };
            modelId = "stability.sd3-5-large-v1:0";
            reqBody = { prompt: toolInput.prompt, output_format: "jpeg" };
        } 
        else if (toolName === 'edit_image') {
            modelId = "amazon.nova-canvas-v1:0";
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

        return result;
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
        const { prompt, aspectRatio } = toolInput;

        if (!prompt) return { error: "Prompt parameter is required for video generation." };

        const videoKeyPrefix = `video-renders/luma-${Date.now()}`;
        const asyncJob = await clients.bedrockRuntime.send(new StartAsyncInvokeCommand({
            modelId: "luma.ray-v2:0",
            modelInput: { prompt: prompt, aspect_ratio: aspectRatio || '16:9' },
            outputDataConfig: {
                s3OutputDataConfig: { s3Uri: `s3://${bucketName}/${videoKeyPrefix}` }
            }
        }));

        const videoUrl = `https://${bucketName}.s3.amazonaws.com/${videoKeyPrefix}/output.mp4`;

        await recordRAGArtifact(
            profile,
            { userId: cognitoUserId, id: sessionId, title: profile?.name },
            videoUrl,
            'VIDEO',
            clients.dynamodb,
            env.RAG_ARTIFACTS_TABLE_NAME
        );

        citations.push({ type: 'media', uri: videoUrl });

        return {
            status: "Success",
            message: "Video generation job submitted successfully.",
            videoUrl: videoUrl,
            jobArn: asyncJob.invocationArn
        };
    } catch (err: any) {
        console.error("Luma Video Generation Error:", err);
        return { error: `Luma Video Error: ${err.message}` };
    }
};