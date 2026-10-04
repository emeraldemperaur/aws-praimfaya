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
        .replace(/[*_#`~>]/g, '') 
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') 
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Extracts DTMF tags that survived sanitization (e.g. [DTMF1], [DTMFSTAR]) 
 * and converts the output to an SSML payload with remote audio injection.
 */
const processSSMLandDTMF = (cleanText: string): { content: string, contentType: 'PlainText' | 'SSML' } => {
    const dtmfRegex = /\[DTMF([0-9]\vert{}STAR\vert{}POUND)\]/gi;
    
    if (!dtmfRegex.test(cleanText)) {
        return { content: cleanText, contentType: 'PlainText' };
    }
    let ssmlContent = cleanText.replace(dtmfRegex, (match, digit) => {
        const tone = digit.toUpperCase();
        return `<audio src="https://praimfaya-public-assets-680439401460-us-east-1-an.s3.us-east-1.amazonaws.com/dtmf/dtmf-${tone}.wav"/>`;
    });

    return { 
        content: `<speak>${ssmlContent}</speak>`, 
        contentType: 'SSML' 
    };
};

export const handler = async (event: any) => {
    const localeId = event.bot?.localeId || 'en-US';
    const sessionAttributes = event.sessionState?.sessionAttributes || {};
    const callId = sessionAttributes.internalCallId;
    const userUtterance = event.inputTranscript || '';
    const isEnglishVariant = localeId.toLowerCase().startsWith('en');
    const strictLanguageGuardrail = isEnglishVariant 
        ? `Ensure you use the appropriate regional dialect and spelling for ${localeId}.` 
        : `Never speak English unless the user explicitly requests it.`;
    if (!callId) return buildLexResponse({ content: "I am missing active call session attributes.", contentType: 'PlainText' }, event, 'Close');
    try {
        const callRecord = await dynamodb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: callId } }));
        const item = callRecord.Item || {};
        const currentTranscript: Array<{ role: string; content: string }> = item.transcript || [];
        if (userUtterance && userUtterance !== 'START_OUTBOUND_CALL') {
            currentTranscript.push({ role: 'user', content: userUtterance });
        }
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

            return buildLexResponse({ content: wrapUpMessage, contentType: 'PlainText' }, event, 'Close');
        }

        const systemPrompt = `You are a conversational voice agent calling a recipient.
OBJECTIVE: ${item.objective}
VOICE TONE: ${item.voiceTone || 'professional'}
DATA TO CAPTURE: ${JSON.stringify(item.dataToCapture || [])}
CRITICAL LANGUAGE INSTRUCTION: You MUST conduct this entire conversation natively in the language corresponding to this locale code: ${localeId}. ${strictLanguageGuardrail}
DIRECTIVE: Keep spoken responses concise (1-2 sentences). Speak naturally without markdown formatting. If the objective is complete or recipient wishes to end, say a polite goodbye.
IVR NAVIGATION: If you reach an automated menu that requires keypad input, you can emit tones by outputting the exact bracketed tags: [DTMF0] through [DTMF9], [DTMFSTAR], or [DTMFPOUND]. For example, if asked to press 1, respond with: "[DTMF1]".`;

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
        const { content: finalContent, contentType } = processSSMLandDTMF(cleanSpeech);
        currentTranscript.push({ role: 'assistant', content: cleanSpeech });

        await dynamodb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: callId },
            UpdateExpression: 'SET transcript = :t, #st = :status',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { ':t': currentTranscript, ':status': 'IN_PROGRESS' },
        }));

        const isGoodbye = /goodbye|have a (great|nice) day|bye for now/i.test(cleanSpeech);
        return buildLexResponse({ content: finalContent, contentType }, event, isGoodbye ? 'Close' : 'ElicitIntent');

    } catch (err: any) {
        console.error("Lex Fulfillment Handler Error:", err);
        return buildLexResponse({ content: "I encountered an issue processing your request. Goodbye!", contentType: 'PlainText' }, event, 'Close');
    }
};

function buildLexResponse(
    messageConfig: { content: string, contentType: 'PlainText' | 'SSML' }, 
    event: any, 
    dialogType: 'ElicitIntent' | 'Close' = 'ElicitIntent'
) {
    const activeIntent = event.sessionState?.intent || { name: 'FallbackIntent' };
    activeIntent.state = dialogType === 'Close' ? 'Fulfilled' : 'InProgress';
    return {
        sessionState: {
            dialogAction: { type: dialogType },
            intent: activeIntent,
            sessionAttributes: event.sessionState?.sessionAttributes || {},
        },
        messages: [{ contentType: messageConfig.contentType, content: messageConfig.content }],
    };
}