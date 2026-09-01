import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({});
const rawDynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);
const TABLE_NAME = process.env.VOICE_AGENT_TRACKING_TABLE!;

const MAX_CALL_TURNS = 30;


const sanitizeSpeechForTTS = (text: string): string => {
    if (!text) return "";
    return text
        .replace(/[*_#`~>]/g, '') // Remove Markdown bold, italics, headers, code blocks
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Convert links to plain text
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}]/gu, '') // Remove emojis
        .replace(/\s+/g, ' ')
        .trim();
};

export const handler = async (event: any) => {
    const sessionAttributes = event.sessionState?.sessionAttributes || {};
    const callId = sessionAttributes.internalCallId;
    const userUtterance = event.inputTranscript || '';

    if (!callId) return buildLexResponse("I am missing active call session attributes.", event, 'Close');

    try {
        const callRecord = await dynamodb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: callId } }));
        const item = callRecord.Item || {};
        const currentTranscript: Array<{ role: string; content: string }> = item.transcript || [];
        
        if (userUtterance) currentTranscript.push({ role: 'user', content: userUtterance });

        if (currentTranscript.length >= MAX_CALL_TURNS) {
            const wrapUpMessage = "Thank you. We have reached the maximum time limit for this call. Goodbye!";
            currentTranscript.push({ role: 'assistant', content: wrapUpMessage });
            
            await dynamodb.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { id: callId },
                UpdateExpression: 'SET transcript = :t, #st = :status',
                ExpressionAttributeNames: { '#st': 'status' },
                ExpressionAttributeValues: { ':t': currentTranscript, ':status': 'IN_PROGRESS' },
            }));

            return buildLexResponse(wrapUpMessage, event, 'Close');
        }

        const systemPrompt = `You are a conversational voice agent calling a recipient.
OBJECTIVE: ${item.objective}
VOICE TONE: ${item.voiceTone || 'professional'}
DATA TO CAPTURE: ${JSON.stringify(item.dataToCapture || [])}
DIRECTIVE: Keep spoken responses concise (1-2 sentences). Speak naturally without markdown formatting. If the objective is complete or recipient wishes to end, say a polite goodbye.`;

        const recentHistory = currentTranscript.slice(-20);
        const bedrockMessages = recentHistory.map((t) => ({
            role: t.role === 'user' ? 'user' : 'assistant',
            content: [{ text: t.content }],
        }));

        let aiResponseText = "Thank you for your time. Have a great day!";
        
        try {
            const bedrockRes = await bedrock.send(new ConverseCommand({
                modelId: 'us.amazon.nova-micro-v1:0', 
                system: [{ text: systemPrompt }],
                messages: bedrockMessages as any,
                inferenceConfig: { maxTokens: 150, temperature: 0.5 }
            }));
            aiResponseText = bedrockRes.output?.message?.content?.[0]?.text || aiResponseText;
        } catch (err) {
            console.error("Bedrock turn execution failed:", err);
        }

        const cleanSpeech = sanitizeSpeechForTTS(aiResponseText);
        currentTranscript.push({ role: 'assistant', content: cleanSpeech });

        await dynamodb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: callId },
            UpdateExpression: 'SET transcript = :t, #st = :status',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { ':t': currentTranscript, ':status': 'IN_PROGRESS' },
        }));

        const isGoodbye = /goodbye|have a (great|nice) day|bye for now/i.test(cleanSpeech);
        return buildLexResponse(cleanSpeech, event, isGoodbye ? 'Close' : 'ElicitIntent');

    } catch (err: any) {
        console.error("Lex Fulfillment Handler Error:", err);
        return buildLexResponse("I encountered an issue processing your request. Goodbye!", event, 'Close');
    }
};

function buildLexResponse(message: string, event: any, dialogType: 'ElicitIntent' | 'Close' = 'ElicitIntent') {
    return {
        sessionState: {
            dialogAction: { type: dialogType },
            intent: event.sessionState?.intent || { name: 'FallbackIntent', state: dialogType === 'Close' ? 'Fulfilled' : 'InProgress' },
            sessionAttributes: event.sessionState?.sessionAttributes || {},
        },
        messages: [{ contentType: 'PlainText', content: message }],
    };
}