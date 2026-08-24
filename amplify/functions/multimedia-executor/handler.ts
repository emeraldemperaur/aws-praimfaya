import { BedrockRuntimeClient, InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const MEDIA_BUCKET = process.env.MEDIA_OUTPUT_BUCKET_NAME!;

export const handler = async (event: any) => {
    // Bedrock Agent Payload Details
    const actionGroup = event.actionGroup;
    const functionName = event.function;
    const parameters = event.parameters || [];
    
    // Helper to extract values from the Bedrock parameters array
    const getParam = (name: string) => parameters.find((p: any) => p.name === name)?.value;

    let responseText = "";

    try {
        if (functionName === 'generate_audio') {
            const text = getParam('text');
            const voiceId = getParam('voiceId') || 'Matthew';

            const pollyRes = await pollyClient.send(new SynthesizeSpeechCommand({ 
                Engine: "generative", OutputFormat: "mp3", Text: text, VoiceId: voiceId 
            }));
            
            const audioBytes = await pollyRes.AudioStream?.transformToByteArray();
            if (audioBytes) {
                const fileName = `audio-renders/${Date.now()}.mp3`;
                await s3Client.send(new PutObjectCommand({ 
                    Bucket: MEDIA_BUCKET, Key: fileName, Body: Buffer.from(audioBytes), ContentType: "audio/mpeg" 
                }));
                responseText = `Success. Audio generated and saved to S3: https://${MEDIA_BUCKET}.s3.amazonaws.com/${fileName}`;
            }

        } else if (functionName === 'generate_image') {
            const prompt = getParam('prompt');
            const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({
                modelId: "stability.sd3-5-large-v1:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({ prompt: prompt, output_format: "jpeg" })
            }));
            responseText = await processImageResponse(invokeRes.body, 'stability');

        } else if (functionName === 'generate_enterprise_image') {
            const prompt = getParam('prompt');
            const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({
                modelId: "amazon.titan-image-generator-v2:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({ taskType: "TEXT_IMAGE", textToImageParams: { text: prompt }, imageGenerationConfig: { numberOfImages: 1, height: 1024, width: 1024 } })
            }));
            responseText = await processImageResponse(invokeRes.body, 'titan');

        } else if (functionName === 'generate_luma_video') {
            const prompt = getParam('prompt');
            const aspectRatio = getParam('aspectRatio') || '16:9';
            
            // Video takes minutes, so we use Async Invoke and provide an S3 destination
            const asyncJob = await bedrockRuntime.send(new StartAsyncInvokeCommand({
                modelId: "luma.ray-v2:0",
                modelInput: { 
                    prompt: prompt, 
                    aspect_ratio: aspectRatio 
                },
                outputDataConfig: {
                    s3OutputDataConfig: {
                        // Tells Bedrock to drop the finished video in this S3 bucket path
                        s3Uri: `s3://${MEDIA_BUCKET}/video-renders` 
                    }
                }
            }));
            
            responseText = `Success. Video generation started asynchronously. S3 Output Prefix: video-renders/. Job ARN: ${asyncJob.invocationArn}`;
        } else {
            responseText = `Error: Unknown function requested - ${functionName}`;
        }

    } catch (error: any) {
        console.error(`Execution failed for ${functionName}:`, error);
        responseText = `Error during execution: ${error.message}`;
    }

    // =================================================================
    // CRITICAL: Must return exactly this schema for Bedrock Agents
    // =================================================================
    return {
        messageVersion: "1.0",
        response: {
            actionGroup: actionGroup,
            function: functionName,
            functionResponse: {
                responseBody: {
                    TEXT: {
                        body: responseText
                    }
                }
            }
        }
    };
};

// Helper: Processes Base64 image payload from Bedrock and uploads to S3
async function processImageResponse(bytes: Uint8Array, family: string): Promise<string> {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    const b64 = body.images?.[0] || body.base64; // Titan uses .images, Stability uses .base64
    if (!b64) throw new Error("No image data returned from model.");
    
    const fileName = `image-renders/${family}-${Date.now()}.jpeg`;
    await s3Client.send(new PutObjectCommand({ 
        Bucket: MEDIA_BUCKET, Key: fileName, Body: Buffer.from(b64, "base64"), ContentType: "image/jpeg" 
    }));
    
    return `Success. Image generated and saved to S3: https://${MEDIA_BUCKET}.s3.amazonaws.com/${fileName}`;
}