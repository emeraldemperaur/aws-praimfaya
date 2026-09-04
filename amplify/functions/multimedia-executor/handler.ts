import { BedrockRuntimeClient, InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, TransactWriteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConnectClient, StartOutboundVoiceContactCommand } from "@aws-sdk/client-connect";
import axios from "axios";
import { executeAttachmentReader } from "../chat-handler/executors/attachment-tools";
import { executeJotformAgent } from "../chat-handler/executors/jotform-tools";

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const MEDIA_BUCKET = process.env.MEDIA_OUTPUT_BUCKET_NAME!;
const RAG_ARTIFACTS_TABLE = process.env.RAG_ARTIFACTS_TABLE_NAME!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;
const TIMEOUT_MS = 10000;

const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { 
    "generate_luma_video": 150000, 
    "generate_image": 30000, 
    "generate_enterprise_image": 4000, 
    "edit_image": 15000,
    "generate_audio": 500,
    "enterprise_voice_agent": 2500,
    "jotform_agile_agent": 500,
    "formstack_agile_agent": 500,
    "generate_document_agent": 100
};


const formatE164 = (phone: string, defaultCountry: string = 'US'): string => {
    if (!phone) return '';
    if (phone.trim().startsWith('+')) return '+' + phone.replace(/[^0-9]/g, '');
    const digits = phone.replace(/[^0-9]/g, '');
    if (!digits) return '';

    if (digits.startsWith('00')) return `+${digits.substring(2)}`;

    const countryMap: Record<string, { code: string; keepLeadingZero?: boolean }> = {
        US: { code: '1' }, CA: { code: '1' }, UK: { code: '44' }, FR: { code: '33' },
        IT: { code: '39', keepLeadingZero: true }, NG: { code: '234' }, ZA: { code: '27' }, JP: { code: '81' }
    };

    const target = countryMap[defaultCountry.toUpperCase()] || { code: '1' };
    let processedDigits = digits;
    if (processedDigits.startsWith('0') && !target.keepLeadingZero) {
        processedDigits = processedDigits.substring(1);
    }
    return `+${target.code}${processedDigits}`;
};

export const handler = async (event: any) => {
    const actionGroup = event.actionGroup;
    const functionName = event.function;
    const parameters = event.parameters || [];

    const getParam = (name: string) => parameters.find((p: any) => p.name === name)?.value;

    const sessionAttrs = event.sessionAttributes || event.requestBody?.sessionAttributes || {};
    const userId = sessionAttrs.userId || event.userId;
    let responseText = "";

    try {
        if (!userId) {
            throw new Error("Missing user identification in session attributes.");
        }

        const requiredCost = MULTIMODAL_TOOL_FLAT_COSTS[functionName] || 0;
        if (requiredCost > 0) {
            const userRes = await dynamodb.send(new GetCommand({ TableName: USER_PROFILES_TABLE, Key: { cognitoUserId: userId } }));
            const availableCredits = userRes.Item?.computeCredits ?? 0;

            if (availableCredits < requiredCost) {
                responseText = `INSUFFICIENT_CREDITS: Executing ${functionName} requires ${requiredCost} compute credits, but you only have ${availableCredits} credits remaining. Please top up your balance.`;
                return buildActionGroupResponse(actionGroup, functionName, responseText);
            }
        }

        if (functionName === 'generate_audio') {
            const text = getParam('text');
            const voiceId = getParam('voiceId') || 'Matthew';
            if (!text) throw new Error("Missing required 'text' parameter.");

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
            if (!prompt) throw new Error("Missing required 'prompt' parameter.");

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
            if (!prompt) throw new Error("Missing required 'prompt' parameter.");

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

        } else if (functionName === 'edit_image') {
            const s3Uri = getParam('s3Uri');
            const taskType = getParam('taskType') || 'BACKGROUND_REMOVAL';
            const prompt = getParam('prompt');
            const maskPrompt = getParam('maskPrompt');

            if (!s3Uri || !s3Uri.startsWith('s3://')) {
                throw new Error("Missing or invalid s3Uri parameter.");
            }

            const uriParts = s3Uri.replace('s3://', '').split('/');
            const bucket = uriParts.shift()!;
            const key = uriParts.join('/');
            
            const s3Response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const byteArray = await s3Response.Body?.transformToByteArray();
            if (!byteArray) throw new Error("Failed to read image from S3.");
            
            const base64Image = Buffer.from(byteArray).toString('base64');
            const payload: any = { taskType };

            if (taskType === "BACKGROUND_REMOVAL") {
                payload.backgroundRemovalParams = { image: base64Image };
            } else if (taskType === "INPAINTING") {
                payload.inPaintingParams = { image: base64Image, text: prompt || "remove object", maskPrompt: maskPrompt || "main subject" };
            } else if (taskType === "OUTPAINTING") {
                payload.outPaintingParams = { image: base64Image, text: prompt || "extend background", outPaintingMode: "DEFAULT" };
            } else if (taskType === "IMAGE_VARIATION") {
                payload.imageVariationParams = { images: [base64Image], text: prompt || "create variation" };
            }

            const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({
                modelId: "amazon.nova-canvas-v1:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload)
            }));

            const imageUrl = await processAndUploadImage(invokeRes.body, 'nova-canvas');
            await recordRAGArtifact(event, imageUrl, 'IMAGE');
            await deductToolCredits(event, functionName);
            
            responseText = `Success. Image edited (${taskType}) and saved to S3: ${imageUrl}`;

        } else if (functionName === 'generate_luma_video') {
            const prompt = getParam('prompt');
            if (!prompt) throw new Error("Missing required 'prompt' parameter.");

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

        } else if (functionName === 'generate_document_agent') {
            const content = getParam('content') || '';
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
            await deductToolCredits(event, functionName);
            responseText = `Success. Document generated and saved to S3: ${fileUrl}`;

        } else if (functionName === 'jotform_agile_agent') {
            const endpoint = getParam('endpoint');
            const method = getParam('method') || 'GET';
            const rawPayload = getParam('payload');
            const rawQueryParams = getParam('queryParams');

            let payload = {};
            let queryParams = {};

            try { if (rawPayload) payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload; } catch {}
            try { if (rawQueryParams) queryParams = typeof rawQueryParams === 'string' ? JSON.parse(rawQueryParams) : rawQueryParams; } catch {}

            const ephemeralSecrets = sessionAttrs.ephemeralSecrets ? JSON.parse(sessionAttrs.ephemeralSecrets) : {};

            const result = await executeJotformAgent({
                toolInput: { endpoint, method, payload, queryParams },
                ephemeralSecrets,
                clients: { dynamodb, s3: s3Client, bedrockRuntime },
                env: process.env as Record<string, string>
            } as any);

            await deductToolCredits(event, functionName);

            if (result.error) {
                responseText = `Jotform API Error: ${result.error}. ${result.details ? JSON.stringify(result.details) : ''}`;
            } else {
                responseText = `Jotform Execution Success: ${JSON.stringify(result)}`;
            }

        } else if (functionName === 'formstack_agile_agent') {
            const endpoint = getParam('endpoint');
            const method = getParam('method') || 'GET';
            const rawPayload = getParam('payload');
            const rawQueryParams = getParam('queryParams');

            let payload = {};
            let queryParams = {};

            try { if (rawPayload) payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload; } catch {}
            try { if (rawQueryParams) queryParams = typeof rawQueryParams === 'string' ? JSON.parse(rawQueryParams) : rawQueryParams; } catch {}

            const secrets = sessionAttrs.ephemeralSecrets ? JSON.parse(sessionAttrs.ephemeralSecrets) : {};
            const apiToken = secrets.formstackToken;

            if (!apiToken) {
                responseText = "Error: Missing Formstack API Token. Request credentials via request_secure_credentials.";
            } else {
                const cleanEndpoint = (endpoint || '/form').startsWith('/') ? endpoint : `/${endpoint}`;
                const finalEndpoint = cleanEndpoint.endsWith('.json') ? cleanEndpoint : `${cleanEndpoint}.json`;
                
                const config: any = {
                    method: method.toUpperCase(),
                    url: `https://www.formstack.com/api/v2${finalEndpoint}`,
                    timeout: TIMEOUT_MS,
                    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }
                };

                if (config.method === 'GET' || config.method === 'DELETE') config.params = queryParams;
                else config.data = payload;

                const response = await axios(config);
                await deductToolCredits(event, functionName);
                responseText = `Formstack Execution Success: ${JSON.stringify(response.data)}`;
            }

        } else if (functionName === 'enterprise_voice_agent') {
            const action = getParam('action');
            const VOICE_CALLS_TABLE = process.env.VOICE_AGENT_TRACKING_TABLE!;

            if (action === 'DISPATCH_CALL') {
                const destPhone = getParam('destinationPhoneNumber');
                const objective = getParam('objective');

                if (!destPhone || !objective) {
                    throw new Error("Missing required destinationPhoneNumber or objective.");
                }

                const formattedPhone = formatE164(destPhone);
                const internalCallId = `va_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const voiceTone = getParam('voiceTone') || 'professional';
                const voiceGender = getParam('voiceGender') || 'FEMALE';
                
                await dynamodb.send(new PutCommand({
                    TableName: VOICE_CALLS_TABLE,
                    Item: {
                        id: internalCallId,
                        userId: userId,
                        destinationPhoneNumber: formattedPhone,
                        objective: objective,
                        dataToCapture: getParam('dataToCapture') ? JSON.parse(getParam('dataToCapture')) : [],
                        voiceTone: voiceTone,
                        voiceGender: voiceGender,
                        status: 'QUEUED',
                        createdAt: new Date().toISOString()
                    }
                }));

                const connectClient = new ConnectClient({ region: process.env.AWS_REGION, maxAttempts: 2 });
                const res = await connectClient.send(new StartOutboundVoiceContactCommand({
                    DestinationPhoneNumber: formattedPhone,
                    ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID!,
                    InstanceId: process.env.CONNECT_INSTANCE_ID!,
                    SourcePhoneNumber: process.env.CONNECT_SOURCE_PHONE_NUMBER!,
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
                responseText = `Success. Voice agent dispatched to ${formattedPhone}. Call ID: ${internalCallId}. Use CHECK_CALL_RESULTS later.`;

            } else if (action === 'CHECK_CALL_RESULTS') {
                const callId = getParam('callId');
                const callRes = await dynamodb.send(new GetCommand({ TableName: VOICE_CALLS_TABLE, Key: { id: callId } }));
                
                if (!callRes.Item) {
                    responseText = `Error: Call ID ${callId} not found.`;
                } else if (['QUEUED', 'DISPATCHED', 'IN_PROGRESS', 'RINGING'].includes(callRes.Item.status)) {
                    responseText = "In Progress: The AI agent is currently on the call or waiting for an answer.";
                } else {
                    responseText = `Call Complete. Status: ${callRes.Item.status}. Summary: ${callRes.Item.summary || 'N/A'}. Captured Data: ${JSON.stringify(callRes.Item.capturedData || {})}`;
                }
            }

        } else if (functionName === 'read_user_attachment') {
            const s3Uri = getParam('s3Uri');
            
            const attachmentContext = {
                toolInput: { s3Uri },
                clients: { s3: s3Client, bedrockRuntime },
                env: process.env
            };
            
            const result = await executeAttachmentReader(attachmentContext as any);
            
            if (result.additionalCreditsUsed && result.additionalCreditsUsed > 0) {
                const sessionId = sessionAttrs.terminalId || event.sessionId || `session-${Date.now()}`;
                
                await recordUsageTransaction(userId, result.additionalCreditsUsed, {
                    sessionId: sessionId,
                    sessionTitle: sessionAttrs.terminalTitle,
                    actionType: 'TOOL_EXECUTION',
                    toolName: functionName,
                });
            }
            
            responseText = JSON.stringify(result);

        } else if (functionName === 'request_secure_credentials') {
            const serviceName = getParam('serviceName');
            responseText = `<vanguard_auth_request>${serviceName}</vanguard_auth_request> Credentials requested successfully. Wait for user response.`;
            
        } else {
            responseText = `Error: Unknown function requested - ${functionName}`;
        }

    } catch (error: any) {
        console.error(`Execution failed for ${functionName}:`, error);
        responseText = `Error during execution: ${error.message}`;
    }

    return buildActionGroupResponse(actionGroup, functionName, responseText);
};

function buildActionGroupResponse(actionGroup: string, functionName: string, text: string) {
    return {
        messageVersion: "1.0",
        response: {
            actionGroup: actionGroup,
            function: functionName,
            functionResponse: {
                responseBody: { TEXT: { body: text } }
            }
        }
    };
}

async function deductToolCredits(event: any, functionName: string) {
    const sessionAttrs = event.sessionAttributes || event.requestBody?.sessionAttributes || {};
    const userId = sessionAttrs.userId || event.userId;
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

    const sessionAttrs = event.sessionAttributes || event.requestBody?.sessionAttributes || {};
    const userId = sessionAttrs.userId || event.userId || 'managed-agent-user';
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
        console.error(`CRITICAL: Transaction failed for user ${userId}. Executing direct credit deduction fallback.`, err);
        try {
            await dynamodb.send(new UpdateCommand({
                TableName: USER_PROFILES_TABLE,
                Key: { cognitoUserId: userId },
                UpdateExpression: "SET computeCredits = computeCredits - :cost",
                ExpressionAttributeValues: { ":cost": cost }
            }));
        } catch (fallbackErr) {
            console.error(`FATAL: Fallback credit deduction failed for user ${userId}:`, fallbackErr);
        }
    }
}