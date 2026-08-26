import { BedrockRuntimeClient, InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

// Standardized Environment Variables
const MEDIA_BUCKET = process.env.MEDIA_OUTPUT_BUCKET_NAME!;
const RAG_ARTIFACTS_TABLE = process.env.RAG_ARTIFACTS_TABLE_NAME!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

// 100% Margin Flat Costs
const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { 
    "generate_luma_video": 150000, 
    "generate_image": 30000, 
    "generate_enterprise_image": 4000, 
    "edit_image": 15000,
    "generate_audio": 500 
};

export const handler = async (event: any) => {
    const actionGroup = event.actionGroup;
    const functionName = event.function;
    const parameters = event.parameters || [];
    
    const getParam = (name: string) => parameters.find((p: any) => p.name === name)?.value;

    let responseText = "";

    try {
        if (functionName === 'generate_audio') {
            const text = getParam('text');
            const voiceId = getParam('voiceId') || 'Matthew';

            const pollyRes = await pollyClient.send(new SynthesizeSpeechCommand({ Engine: "generative", OutputFormat: "mp3", Text: text, VoiceId: voiceId }));
            const audioBytes = await pollyRes.AudioStream?.transformToByteArray();
            
            if (audioBytes) {
                const fileName = `audio-renders/${Date.now()}.mp3`;
                await s3Client.send(new PutObjectCommand({ Bucket: MEDIA_BUCKET, Key: fileName, Body: Buffer.from(audioBytes), ContentType: "audio/mpeg" }));
                const audioUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/${fileName}`;
                
                await recordRAGArtifact(event, audioUrl, 'AUDIO');
                
                await deductToolCredits(event, functionName);
                responseText = `Success. Audio generated and saved to S3: ${audioUrl}`;
            }

        } else if (functionName === 'generate_image') {
            const prompt = getParam('prompt');
            const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({
                modelId: "stability.sd3-5-large-v1:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({ prompt: prompt, output_format: "jpeg" })
            }));
            
            const imageUrl = await processAndUploadImage(invokeRes.body, 'stability');
            await recordRAGArtifact(event, imageUrl, 'IMAGE');
            
            await deductToolCredits(event, functionName);
            responseText = `Success. Image generated and saved to S3: ${imageUrl}`;

        } else if (functionName === 'generate_enterprise_image') {
            const prompt = getParam('prompt');
            const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({
                modelId: "amazon.titan-image-generator-v2:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({ taskType: "TEXT_IMAGE", textToImageParams: { text: prompt }, imageGenerationConfig: { numberOfImages: 1, height: 1024, width: 1024 } })
            }));
            
            const imageUrl = await processAndUploadImage(invokeRes.body, 'titan');
            await recordRAGArtifact(event, imageUrl, 'IMAGE');
            
            // DEDUCT CREDITS BEFORE SUCCESS
            await deductToolCredits(event, functionName);
            responseText = `Success. Enterprise Image generated and saved to S3: ${imageUrl}`;

        } else if (functionName === 'generate_luma_video') {
            const prompt = getParam('prompt');
            const aspectRatio = getParam('aspectRatio') || '16:9';
            const videoKeyPrefix = `video-renders/luma-${Date.now()}`;
            
            const asyncJob = await bedrockRuntime.send(new StartAsyncInvokeCommand({
                modelId: "luma.ray-v2:0",
                modelInput: { prompt: prompt, aspect_ratio: aspectRatio },
                outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${MEDIA_BUCKET}/${videoKeyPrefix}` } }
            }));

            const videoUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/${videoKeyPrefix}/output.mp4`;
            await recordRAGArtifact(event, videoUrl, 'VIDEO');
            
            await deductToolCredits(event, functionName);
            responseText = `Success. Video generation job submitted. Destination: ${videoUrl}. Job ARN: ${asyncJob.invocationArn}`;
            
        } else if (functionName === 'generate_document') {
            const content = getParam('content');
            const filePrefix = getParam('fileName') || 'document';
            const format = getParam('format') || 'md';
            
            const safeName = filePrefix.replace(/[^a-zA-Z0-9-_]/g, '');
            const s3Key = `documents/${safeName}-${Date.now()}.${format}`;
            
            let mimeType = 'text/plain';
            if (format === 'html') mimeType = 'text/html';
            if (format === 'csv') mimeType = 'text/csv';
            if (format === 'md') mimeType = 'text/markdown';

            await s3Client.send(new PutObjectCommand({ Bucket: MEDIA_BUCKET, Key: s3Key, Body: content, ContentType: mimeType }));
            const fileUrl = `https://${MEDIA_BUCKET}.s3.amazonaws.com/${s3Key}`;
            
            await recordRAGArtifact(event, fileUrl, 'DOCUMENT');
            
            responseText = `Success. Document generated and saved to S3: ${fileUrl}`;

        } else {
            responseText = `Error: Unknown function requested - ${functionName}`;
        }

    } catch (error: any) {
        console.error(`Execution failed for ${functionName}:`, error);
        responseText = `Error during execution: ${error.message}`;
    }

    return {
        messageVersion: "1.0",
        response: {
            actionGroup: actionGroup,
            function: functionName,
            functionResponse: {
                responseBody: { TEXT: { body: responseText } }
            }
        }
    };
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

async function deductToolCredits(event: any, functionName: string) {
    const sessionAttrs = event.sessionAttributes || {};
    const userId = sessionAttrs.userId;
    const sessionId = sessionAttrs.terminalId || event.sessionId || `session-${Date.now()}`;
    const cost = MULTIMODAL_TOOL_FLAT_COSTS[functionName];

    if (userId && cost) {
        await recordUsageTransaction(userId, cost, {
            sessionId: sessionId,
            sessionTitle: sessionAttrs.terminalTitle,
            actionType: 'TOOL_EXECUTION',
            toolName: functionName,
        });
    }
}

async function processAndUploadImage(bytes: Uint8Array, family: string): Promise<string> {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    const b64 = body.images?.[0] || body.base64;
    if (!b64) throw new Error("No image data returned from model.");
    
    const fileName = `image-renders/${family}-${Date.now()}.jpeg`;
    await s3Client.send(new PutObjectCommand({ 
        Bucket: MEDIA_BUCKET, Key: fileName, Body: Buffer.from(b64, "base64"), ContentType: "image/jpeg" 
    }));
    
    return `https://${MEDIA_BUCKET}.s3.amazonaws.com/${fileName}`;
}

async function recordRAGArtifact(event: any, fileUrl: string, fileType: string) {
    if (!RAG_ARTIFACTS_TABLE) return;

    const sessionAttrs = event.sessionAttributes || {};
    const userId = sessionAttrs.userId || 'managed-agent-user';
    const terminalId = sessionAttrs.terminalId || event.sessionId || `session-${Date.now()}`;
    const terminalTitle = sessionAttrs.terminalTitle || 'Supervisor Managed Session';
    const profileName = sessionAttrs.contextProfileName || 'Supervisor Agent';
    const fileName = fileUrl.split('/').pop() || 'artifact';

    try {
        await dynamodb.send(new PutCommand({
            TableName: RAG_ARTIFACTS_TABLE,
            Item: {
                id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId: userId,
                terminalId: terminalId,
                terminalTitle: terminalTitle,
                modelName: 'aws-bedrock-managed-agent',
                contextProfileName: profileName,
                fileUrl: fileUrl,
                fileName: fileName,
                fileType: fileType,
                createdAt: new Date().toISOString()
            }
        }));
    } catch (err) {
        console.error("Failed to record RAG Artifact from Managed Agent:", err);
    }
}

async function recordUsageTransaction(
    userId: string, 
    cost: number, 
    telemetry: {
        sessionId: string,
        sessionTitle?: string,
        actionType: 'LLM_INFERENCE' | 'TOOL_EXECUTION',
        modelId?: string,
        toolName?: string,
        inputTokens?: number,
        outputTokens?: number
    }
) {
    if (cost <= 0) return;

    const recordId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    try {
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    // Deduct compute usage balance
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId: userId },
                        UpdateExpression: "SET computeCredits = computeCredits - :cost",
                        ExpressionAttributeValues: { ":cost": cost }
                    }
                },
                {
                    // Mirror compute usage to UsageRecords table for telemetry
                    Put: {
                        TableName: USAGE_RECORDS_TABLE,
                        Item: {
                            id: recordId,
                            userId: userId,
                            sessionId: telemetry.sessionId,
                            sessionTitle: telemetry.sessionTitle || 'Terminal Session',
                            actionType: telemetry.actionType,
                            modelId: telemetry.modelId || 'N/A',
                            toolName: telemetry.toolName || 'N/A',
                            creditsUsed: cost,
                            inputTokens: telemetry.inputTokens || 0,
                            outputTokens: telemetry.outputTokens || 0,
                            createdAt: now
                        }
                    }
                }
            ]
        }));
    } catch (err) {
        console.error(`CRITICAL: Transaction failed for user ${userId}. Credits not deducted.`, err);
    }
}