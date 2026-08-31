import { BedrockRuntimeClient, InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConnectClient, StartOutboundVoiceContactCommand } from "@aws-sdk/client-connect";
import axios from "axios";
import { executeExtractPdf } from "../chat-handler/executors/document-tools";

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const MEDIA_BUCKET = process.env.MEDIA_OUTPUT_BUCKET_NAME!;
const RAG_ARTIFACTS_TABLE = process.env.RAG_ARTIFACTS_TABLE_NAME!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { 
    "generate_luma_video": 150000, 
    "generate_image": 30000, 
    "generate_enterprise_image": 4000, 
    "edit_image": 15000,
    "generate_audio": 500,
    "enterprise_voice_agent": 2500
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

        } else if (functionName === 'formstack_agile_agent') {
            const endpoint = getParam('endpoint');
            const method = getParam('method') || 'GET';
            const payload = getParam('payload') ? JSON.parse(getParam('payload')) : {};
            const queryParams = getParam('queryParams') ? JSON.parse(getParam('queryParams')) : {};
            
            const secrets = event.sessionAttributes?.ephemeralSecrets ? JSON.parse(event.sessionAttributes.ephemeralSecrets) : {};
            const apiToken = secrets.formstackToken;

            if (!apiToken) {
                responseText = "Error: Missing Formstack API Token. Request the user provide their credentials using request_secure_credentials.";
            } else {
                const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
                const finalEndpoint = cleanEndpoint.endsWith('.json') ? cleanEndpoint : `${cleanEndpoint}.json`;
                
                const config: any = {
                    method: method.toUpperCase(),
                    url: `https://www.formstack.com/api/v2${finalEndpoint}`,
                    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }
                };

                if (config.method === 'GET' || config.method === 'DELETE') config.params = queryParams;
                else config.data = payload;

                const response = await axios(config);
                responseText = `Formstack Execution Success: ${JSON.stringify(response.data)}`;
            }

        } else if (functionName === 'enterprise_voice_agent') {
            const action = getParam('action');
            const VOICE_CALLS_TABLE = process.env.VOICE_AGENT_TRACKING_TABLE!;
            const userId = event.sessionAttributes?.userId || 'managed-agent-user';

            if (action === 'DISPATCH_CALL') {
                const internalCallId = `va_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const voiceTone = getParam('voiceTone') || 'professional';
                const voiceGender = getParam('voiceGender') || 'FEMALE';
                const destPhone = getParam('destinationPhoneNumber');
                
                await dynamodb.send(new PutCommand({
                    TableName: VOICE_CALLS_TABLE,
                    Item: {
                        id: internalCallId,
                        userId: userId,
                        destinationPhoneNumber: destPhone,
                        objective: getParam('objective'),
                        dataToCapture: getParam('dataToCapture') ? JSON.parse(getParam('dataToCapture')) : [],
                        voiceTone: voiceTone,
                        voiceGender: voiceGender,
                        status: 'QUEUED',
                        createdAt: new Date().toISOString()
                    }
                }));

                const connectClient = new ConnectClient({ region: process.env.AWS_REGION });
                const res = await connectClient.send(new StartOutboundVoiceContactCommand({
                    DestinationPhoneNumber: destPhone,
                    ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID!,
                    InstanceId: process.env.CONNECT_INSTANCE_ID!,
                    SourcePhoneNumber: process.env.CONNECT_SOURCE_PHONE_NUMBER!,
                    TrafficType: 'CAMPAIGN',
                    AnswerMachineDetectionConfig: { EnableAnswerMachineDetection: true, AwaitAnswerMachinePrompt: false },
                    Attributes: { internalCallId, voiceTone, voiceGender }
                }));

                await dynamodb.send(new UpdateCommand({
                    TableName: VOICE_CALLS_TABLE,
                    Key: { id: internalCallId },
                    UpdateExpression: "SET #st = :status, providerCallId = :sid",
                    ExpressionAttributeNames: { "#st": "status" },
                    ExpressionAttributeValues: { ":status": "DISPATCHED", ":sid": res.ContactId }
                }));

                await deductToolCredits(event, functionName);
                responseText = `Success. Voice agent dispatched. Call ID: ${internalCallId}. Use CHECK_CALL_RESULTS later.`;

            } else if (action === 'CHECK_CALL_RESULTS') {
                const callId = getParam('callId');
                const callRes = await dynamodb.send(new GetCommand({ TableName: VOICE_CALLS_TABLE, Key: { id: callId } }));
                
                if (!callRes.Item) {
                    responseText = `Error: Call ID ${callId} not found.`;
                } else if (['QUEUED', 'DISPATCHED', 'IN_PROGRESS', 'RINGING'].includes(callRes.Item.status)) {
                    responseText = "In Progress: The AI agent is currently on the call or waiting for an answer.";
                } else {
                    responseText = `Call Complete. Status: ${callRes.Item.status}. Summary: ${callRes.Item.summary}. Captured Data: ${JSON.stringify(callRes.Item.capturedData || {})}`;
                }
            }

        } else if (functionName === 'extract_pdf') {
            const fileUrl = getParam('fileUrl');
            const maxPages = getParam('maxPages') || 15;
            
            const pdfContext = {
                toolInput: { fileUrl, maxPages },
                clients: { s3: s3Client },
                env: process.env
            };
            
            const result = await executeExtractPdf(pdfContext as any);
            
            responseText = JSON.stringify(result);
        } 
        else if (functionName === 'request_secure_credentials') {
            const serviceName = getParam('serviceName');
            responseText = `<vanguard_auth_request>${serviceName}</vanguard_auth_request> Credentials requested successfully. Wait for the user to reply.`;
            
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
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId: userId },
                        UpdateExpression: "SET computeCredits = computeCredits - :cost",
                        ExpressionAttributeValues: { ":cost": cost }
                    }
                },
                {
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