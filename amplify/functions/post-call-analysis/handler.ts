import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import PDFDocument from 'pdfkit';

const bedrock = new BedrockRuntimeClient({});
const s3Client = new S3Client({});
const rawDynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const TABLE_NAME = process.env.VOICE_AGENT_TRACKING_TABLE!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;
const RAG_ARTIFACTS_TABLE = process.env.RAG_ARTIFACTS_TABLE_NAME!;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME!;
const LLM_CREDIT_MULTIPLIER = 2;
const LEX_TURN_CREDIT_COST = 200;
const TELEPHONY_BASE_CREDITS_PER_MIN = 200;
const TELEPHONY_PROFIT_MULTIPLIER = 2.5;

const safeJsonObject = (data: any, fallback: any = {}): Record<string, any> => {
    if (!data) return fallback;
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    try {
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const parseS3Uri = (s3Uri: string): { bucket: string; key: string } | null => {
    if (!s3Uri || !s3Uri.startsWith('s3://')) return null;
    const parts = s3Uri.replace('s3://', '').split('/');
    const bucket = parts.shift();
    const key = parts.join('/');
    return (bucket && key) ? { bucket, key } : null;
};

const calculateTelephonyCredits = (durationSeconds: number): number => {
    if (durationSeconds <= 0) return 0;
    const durationMinutes = durationSeconds / 60;
    return Math.ceil(durationMinutes * TELEPHONY_BASE_CREDITS_PER_MIN * TELEPHONY_PROFIT_MULTIPLIER);
};

const generateEnterprisePDF = async (callData: any, analysisResult: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fillColor('#0B0B45').fontSize(24).font('Helvetica-Bold').text('PRAIMFAYA', { align: 'right' });
        doc.fontSize(10).fillColor('#6b7280').text('Enterprise Voice Agent Analysis Report', { align: 'right' });
        doc.moveDown(2);

        // Title & Meta
        doc.fillColor('#111827').fontSize(18).text(`Call Report: ${callData.destinationPhoneNumber || 'Outbound'}`);
        doc.fontSize(10).fillColor('#4b5563')
           .text(`Call ID: ${callData.id}`)
           .text(`Date: ${new Date().toLocaleString()}`)
           .text(`Duration: ${callData.durationSeconds || 0} seconds`)
           .text(`Status: ${analysisResult.completionStatus}`);
        doc.moveDown(2);

        // Summary
        doc.fillColor('#2563eb').fontSize(14).font('Helvetica-Bold').text('Executive Summary');
        doc.rect(50, doc.y + 5, 495, 1).fill('#e5e7eb');
        doc.moveDown(1.5);
        doc.fillColor('#374151').fontSize(11).font('Helvetica').text(analysisResult.summary, { lineGap: 4 });
        doc.moveDown(2);

        // Captured Data
        doc.fillColor('#2563eb').fontSize(14).font('Helvetica-Bold').text('Captured Data');
        doc.rect(50, doc.y + 5, 495, 1).fill('#e5e7eb');
        doc.moveDown(1.5);
        
        const capturedKeys = Object.keys(analysisResult.capturedData || {});
        if (capturedKeys.length > 0) {
            capturedKeys.forEach(key => {
                doc.font('Helvetica-Bold').fillColor('#111827').text(`${key}: `, { continued: true })
                   .font('Helvetica').fillColor('#374151').text(String(analysisResult.capturedData[key]));
            });
        } else {
            doc.font('Helvetica-Oblique').fillColor('#6b7280').text('No structured data captured during this call.');
        }
        doc.moveDown(2);

        doc.addPage();
        doc.fillColor('#2563eb').fontSize(14).font('Helvetica-Bold').text('Full Transcript');
        doc.rect(50, doc.y + 5, 495, 1).fill('#e5e7eb');
        doc.moveDown(1.5);

        (callData.transcript || []).forEach((turn: any) => {
            if (doc.y > 700) doc.addPage();

            const isUser = turn.role === 'user';
            doc.font('Helvetica-Bold').fillColor(isUser ? '#111827' : '#2563eb').text(isUser ? 'RECIPIENT: ' : 'AGENT: ', { continued: true })
               .font('Helvetica').fillColor('#374151').text(turn.content, { lineGap: 2 });
            doc.moveDown(0.5);
        });

        // Footer
        doc.fontSize(8).fillColor('#9ca3af').text('Generated automatically by Vanguard AI Post-Call Analysis', 50, doc.page.height - 50, { align: 'center' });

        doc.end();
    });
};

export const handler = async (event: any) => {
    const callId = event.detail?.attributes?.internalCallId;
    const disconnectReason = event.detail?.disconnectReason || 'COMPLETED';

    if (!callId) return;
    const connectedAtStr = event.detail?.connectedToSystemTimestamp || event.detail?.initiationTimestamp;
    const disconnectedAtStr = event.detail?.disconnectTimestamp;
    let durationSeconds = 0;
    if (connectedAtStr && disconnectedAtStr) {
        durationSeconds = Math.max(0, Math.ceil((new Date(disconnectedAtStr).getTime() - new Date(connectedAtStr).getTime()) / 1000));
    } else if (event.detail?.agentInteractionDuration) {
        durationSeconds = Number(event.detail.agentInteractionDuration);
    }

    try {
        await dynamodb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: callId },
            UpdateExpression: 'SET #st = :analyzing, durationSeconds = :dur',
            ConditionExpression: '#st IN (:queued, :dispatched, :in_progress)',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
                ':analyzing': 'ANALYZING',
                ':queued': 'QUEUED',
                ':dispatched': 'DISPATCHED',
                ':in_progress': 'IN_PROGRESS',
                ':dur': durationSeconds
            }
        }));
    } catch (err: any) {
        if (err.name === 'ConditionalCheckFailedException') {
            console.log(`Call ID ${callId} is already processed or analyzing. Skipping.`);
            return;
        }
        throw err;
    }

    const callRecord = await dynamodb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: callId } }));
    if (!callRecord.Item) return;

    const { userId, objective, dataToCapture, transcript = [], destinationPhoneNumber, parentSessionId } = callRecord.Item;

    const telephonyCredits = calculateTelephonyCredits(durationSeconds);

    if (transcript.length === 0) {
        await dynamodb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: callId },
            UpdateExpression: 'SET #st = :status, completionStatus = :cs, summary = :sum, recipientType = :rt',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { 
                ':status': 'NO_ANSWER', 
                ':cs': 'Unanswered or rejected call.', 
                ':sum': 'No conversation recorded.', 
                ':rt': 'UNKNOWN' 
            },
        }));

        if (telephonyCredits > 0 && userId) {
            await executeBillingTransaction(userId, callId, destinationPhoneNumber, telephonyCredits, 0, 0, 'No-Answer Call Line Time');
        }
        return;
    }

    const analysisPrompt = `Analyze the following voice call transcript.
OBJECTIVE: ${objective}
FIELDS TO EXTRACT: ${JSON.stringify(dataToCapture || [])}
DISCONNECT REASON: ${disconnectReason}

TRANSCRIPT:
${transcript.map((t: any) => `${t.role.toUpperCase()}:${t.content}`).join('\n')}

Respond ONLY with a valid JSON object matching this exact structure:
{
  "recipientType": "HUMAN or VOICEMAIL",
  "completionStatus": "A short statement on whether objective was met",
  "summary": "Concise summary of the interaction. Explicitly state if a voicemail was reached.",
  "capturedData": { "field_name": "extracted_value" }
}`;

    let analysisResult = { recipientType: "UNKNOWN", completionStatus: "Completed", summary: "Call completed.", capturedData: {} };
    let inputTokens = 0;
    let outputTokens = 0;

    try {
        const res = await bedrock.send(new ConverseCommand({
            modelId: 'us.amazon.nova-pro-v1:0',
            messages: [{ role: 'user', content: [{ text: analysisPrompt }] }],
            inferenceConfig: { temperature: 0.2, maxTokens: 1000 }
        }));
        
        inputTokens = res.usage?.inputTokens || 0;
        outputTokens = res.usage?.outputTokens || 0;

        const rawJson = (res.output?.message?.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
        analysisResult = safeJsonObject(rawJson, analysisResult) as any;
    } catch (err) { 
        console.error("Post-call extraction failed:", err); 
    }

    const finalStatus = disconnectReason === 'COMPLETED' ? 'COMPLETED' : 'ENDED_ABRUPTLY';

    await dynamodb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: callId },
        UpdateExpression: 'SET #st = :status, completionStatus = :cs, summary = :sum, capturedData = :cd, recipientType = :rt',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
            ':status': finalStatus,
            ':cs': analysisResult.completionStatus || 'Completed',
            ':sum': analysisResult.summary || 'Call finished.',
            ':cd': analysisResult.capturedData || {},
            ':rt': analysisResult.recipientType || 'UNKNOWN'
        },
    }));

    const lexTurnsCost = transcript.length * LEX_TURN_CREDIT_COST;
    const analysisLlmCost = Math.ceil((inputTokens + outputTokens) * LLM_CREDIT_MULTIPLIER);
    const totalCostToDeduct = telephonyCredits + lexTurnsCost + analysisLlmCost;

    if (totalCostToDeduct > 0 && userId) {
        await executeBillingTransaction(userId, callId, destinationPhoneNumber, totalCostToDeduct, inputTokens, outputTokens, `Autonomous Call (${durationSeconds}s duration)`);

        const safePhone = (destinationPhoneNumber || 'Outbound').replace(/[^a-zA-Z0-9+]/g, '');

        try {
            console.log(`Generating PDF report for ${callId}...`);
            const pdfBuffer = await generateEnterprisePDF({ ...callRecord.Item, durationSeconds }, analysisResult);
            
            const fileName = `Call_Report_${safePhone}_${Date.now()}.pdf`;
            const s3Key = `public/artifacts/${userId}/${fileName}`; 

            await s3Client.send(new PutObjectCommand({
                Bucket: STORAGE_BUCKET,
                Key: s3Key,
                Body: pdfBuffer,
                ContentType: 'application/pdf',
                ContentDisposition: `inline; filename="${fileName}"`
            }));

            const artifactId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            
            await dynamodb.send(new PutCommand({
                TableName: RAG_ARTIFACTS_TABLE,
                Item: {
                    __typename: 'RAGArtifact',
                    id: artifactId,
                    userId: userId,
                    terminalId: parentSessionId || callId, 
                    terminalTitle: `Voice Agent: ${safePhone}`,
                    fileName: fileName,
                    fileUrl: s3Key, 
                    fileType: 'DOCUMENT',
                    createdAt: new Date().toISOString()
                }
            }));
        } catch (artifactErr) {
            console.error(`Failed to generate or upload PDF artifact for call ${callId}:`, artifactErr);
        }

        const rawRecordingUri = event.detail?.recordings?.[0]?.location || event.detail?.recordingLocation;
        if (rawRecordingUri) {
            try {
                const s3Source = parseS3Uri(rawRecordingUri);
                if (s3Source) {
                    const audioFileName = `Call_Recording_${safePhone}_${Date.now()}.wav`;
                    const audioS3Key = `public/artifacts/${userId}/${audioFileName}`;

                    await s3Client.send(new CopyObjectCommand({
                        CopySource: `${s3Source.bucket}/${encodeURIComponent(s3Source.key).replace(/%2F/g, '/')}`,
                        Bucket: STORAGE_BUCKET,
                        Key: audioS3Key,
                    }));

                    const audioArtifactId = `art_audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

                    await dynamodb.send(new PutCommand({
                        TableName: RAG_ARTIFACTS_TABLE,
                        Item: {
                            __typename: 'RAGArtifact',
                            id: audioArtifactId,
                            userId: userId,
                            terminalId: parentSessionId || callId,
                            terminalTitle: `Voice Call Audio: ${safePhone}`,
                            fileName: audioFileName,
                            fileUrl: audioS3Key,
                            fileType: 'AUDIO',
                            createdAt: new Date().toISOString()
                        }
                    }));
                }
            } catch (audioErr) {
                console.error(`Failed to copy or register call recording artifact for ${callId}:`, audioErr);
            }
        }
    }
};

async function executeBillingTransaction(
    userId: string, 
    callId: string, 
    destinationPhoneNumber: string, 
    creditsToDeduct: number, 
    inputTokens: number, 
    outputTokens: number,
    description: string
) {
    const recordId = `usg_voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let userProfileId: string | null = null;
    
    try {
        const profileQuery = await dynamodb.send(new QueryCommand({
            TableName: USER_PROFILES_TABLE,
            IndexName: "byCognitoId",
            KeyConditionExpression: "cognitoUserId = :uid",
            ExpressionAttributeValues: { ":uid": userId }
        }));

        if (!profileQuery.Items || profileQuery.Items.length === 0) {
            throw new Error(`Cannot bill user: UserProfile not found for cognitoId ${userId}`);
        }
        userProfileId = profileQuery.Items[0].id;

        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { id: userProfileId },
                        UpdateExpression: "SET computeCredits = if_not_exists(computeCredits, :zero) - :cost",
                        ExpressionAttributeValues: { ":cost": creditsToDeduct, ":zero": 0 }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE, 
                        Item: {
                            __typename: 'UsageRecord',
                            id: recordId,
                            userId: userId,
                            sessionId: callId,
                            sessionTitle: `${description} (${destinationPhoneNumber || 'Outbound'})`,
                            actionType: 'TOOL_EXECUTION',
                            modelId: 'amazon.nova-pro-v1:0/amazon-lex',
                            toolName: 'enterprise_voice_agent',
                            creditsUsed: creditsToDeduct,
                            inputTokens: inputTokens,
                            outputTokens: outputTokens,
                            createdAt: new Date().toISOString()
                        }
                    }
                }
            ]
        }));
    } catch (billingErr) {
        console.error(`CRITICAL BILLING TRANSACTION FAILURE for ${callId}:`, billingErr);
        if (userProfileId) {
            try {
                await dynamodb.send(new UpdateCommand({
                    TableName: USER_PROFILES_TABLE,
                    Key: { id: userProfileId },
                    UpdateExpression: "SET computeCredits = if_not_exists(computeCredits, :zero) - :cost",
                    ExpressionAttributeValues: { ":cost": creditsToDeduct, ":zero": 0 }
                }));
            } catch (fallbackErr) {
                console.error(`FATAL: Fallback credit deduction failed for ${callId}:`, fallbackErr);
            }
        }
    }
}