import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({});
const rawDynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const TABLE_NAME = process.env.VOICE_AGENT_TRACKING_TABLE!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const LLM_CREDIT_MULTIPLIER = 2; 
const LEX_TURN_CREDIT_COST = 200;

export const handler = async (event: any) => {
  const callId = event.detail?.attributes?.internalCallId;
  const disconnectReason = event.detail?.disconnectReason || 'COMPLETED';

  if (!callId) return;

  const callRecord = await dynamodb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: callId } }));
  if (!callRecord.Item) return;

  const { userId, objective, dataToCapture, transcript = [], createdAt, destinationPhoneNumber } = callRecord.Item;

  if (transcript.length === 0) {
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: callId },
      UpdateExpression: 'SET #st = :status, completionStatus = :cs, summary = :sum, recipientType = :rt',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { 
          ':status': 'NO_ANSWER', 
          ':cs': 'Unanswered.', 
          ':sum': 'No conversation recorded.', 
          ':rt': 'UNKNOWN' 
      },
    }));
    return;
  }

  const analysisPrompt = `Analyze the following voice call transcript.
OBJECTIVE: ${objective}
FIELDS TO EXTRACT: ${JSON.stringify(dataToCapture || [])}
DISCONNECT REASON: ${disconnectReason}

TRANSCRIPT:
${transcript.map((t: any) => `${t.role.toUpperCase()}: ${t.content}`).join('\n')}

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
    }));
    
    inputTokens = res.usage?.inputTokens || 0;
    outputTokens = res.usage?.outputTokens || 0;

    const rawJson = (res.output?.message?.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
    analysisResult = JSON.parse(rawJson);
  } catch (err) { console.error("Extraction failed:", err); }

  await dynamodb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: callId },
    UpdateExpression: 'SET #st = :status, completionStatus = :cs, summary = :sum, capturedData = :cd, recipientType = :rt',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: {
      ':status': disconnectReason === 'COMPLETED' ? 'COMPLETED' : 'ENDED_ABRUPTLY',
      ':cs': analysisResult.completionStatus,
      ':sum': analysisResult.summary,
      ':cd': analysisResult.capturedData,
      ':rt': analysisResult.recipientType || 'UNKNOWN'
    },
  }));

  
  
  const lexTurnsCost = transcript.length * LEX_TURN_CREDIT_COST;
  const analysisLlmCost = Math.ceil((inputTokens + outputTokens) * LLM_CREDIT_MULTIPLIER);
  const totalCostToDeduct = lexTurnsCost + analysisLlmCost;

  if (totalCostToDeduct > 0 && userId) {
    const recordId = `usg_voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    try {
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId: userId },
                        UpdateExpression: "SET computeCredits = computeCredits - :cost",
                        ExpressionAttributeValues: { ":cost": totalCostToDeduct }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE, 
                        Item: {
                            id: recordId,
                            userId: userId,
                            sessionId: callId,
                            sessionTitle: `Autonomous Voice Call (${destinationPhoneNumber || 'Outbound'})`,
                            actionType: 'VOICE_AGENT_EXECUTION',
                            modelId: 'amazon.nova-pro-v1:0/amazon-lex',
                            toolName: 'enterprise_voice_agent',
                            creditsUsed: totalCostToDeduct,
                            inputTokens: inputTokens,
                            outputTokens: outputTokens,
                            createdAt: new Date().toISOString()
                        }
                    }
                }
            ]
        }));
    } catch (billingErr) {
        console.error(`CRITICAL BILLING FAILURE for Voice Call ${callId}:`, billingErr);
    }
  }
};