import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({});
const rawDynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);
const TABLE_NAME = process.env.VOICE_AGENT_TRACKING_TABLE!;

export const handler = async (event: any) => {
  const sessionAttributes = event.sessionState?.sessionAttributes || {};
  const callId = sessionAttributes.internalCallId;
  const userUtterance = event.inputTranscript || '';

  if (!callId) return buildLexResponse("I am missing active call session attributes.", event);

  const callRecord = await dynamodb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: callId } }));
  const item = callRecord.Item || {};
  const currentTranscript: Array<{ role: string; content: string }> = item.transcript || [];
  
  if (userUtterance) currentTranscript.push({ role: 'user', content: userUtterance });

  const systemPrompt = `You are a conversational voice agent calling a recipient.
OBJECTIVE: ${item.objective}
VOICE TONE: ${item.voiceTone || 'professional'}
DATA TO CAPTURE: ${JSON.stringify(item.dataToCapture || [])}
DIRECTIVE: Keep spoken responses concise (1-2 sentences). Speak naturally without markdown. If the objective is complete, say a polite goodbye.`;

  const bedrockMessages = currentTranscript.map((t) => ({
    role: t.role === 'user' ? 'user' : 'assistant',
    content: [{ text: t.content }],
  }));

  let aiResponseText = "Thank you for your time. Have a great day!";
  
  try {
    const bedrockRes = await bedrock.send(new ConverseCommand({
      modelId: 'us.amazon.nova-micro-v1:0', 
      system: [{ text: systemPrompt }],
      messages: bedrockMessages as any,
    }));
    aiResponseText = bedrockRes.output?.message?.content?.[0]?.text || aiResponseText;
  } catch (err) {
    console.error("Bedrock turn failed:", err);
  }

  currentTranscript.push({ role: 'assistant', content: aiResponseText });

  await dynamodb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: callId },
    UpdateExpression: 'SET transcript = :t, #st = :status',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: { ':t': currentTranscript, ':status': 'IN_PROGRESS' },
  }));

  return buildLexResponse(aiResponseText, event);
};

function buildLexResponse(message: string, event: any) {
  return {
    sessionState: {
      dialogAction: { type: 'ElicitIntent' },
      intent: event.sessionState?.intent || { name: 'FallbackIntent', state: 'InProgress' },
      sessionAttributes: event.sessionState?.sessionAttributes || {},
    },
    messages: [{ contentType: 'PlainText', content: message }],
  };
}