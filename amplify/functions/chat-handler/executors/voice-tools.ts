import { ConnectClient, StartOutboundVoiceContactCommand } from "@aws-sdk/client-connect";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ToolExecutionContext } from './types';

const safeJsonArray = (data: any): any[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [data];
        }
    }
    return [data];
};

const formatE164 = (phone: string, defaultCountryCode = '1'): string => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) { return `+33${cleaned.substring(1)}`; }
    if (cleaned.length === 10) { return `+${defaultCountryCode}${cleaned}`; }
    return `+${cleaned}`;
};

const preserveBalancedSummary = (rawSummary?: string): string => {
    if (!rawSummary) return "No summary available.";
    if (rawSummary.length <= 2500) return rawSummary;

    const head = rawSummary.substring(0, 1000).trim();
    const tail = rawSummary.substring(rawSummary.length - 1500).trim();

    return `${head}\n\n--- [Middle Discussion Omitted (${rawSummary.length - 2500} chars)] ---\n\n${tail}`;
};

interface VoiceConfig {
    voiceActor: string;
    languageCode: string;
}

const resolveVoiceConfig = (languageCode?: string, voiceGender?: string): VoiceConfig => {
    const rawLocale = (languageCode || 'en-US').toLowerCase();
    const primaryLang = rawLocale.split('-')[0];
    const isMale = voiceGender?.toUpperCase() === 'MALE';

    const voiceMap: Record<string, { male: string; female: string; defaultLocale: string }> = {
        'en': { male: 'Matthew', female: 'Danielle', defaultLocale: 'en-US' },
        'en-us': { male: 'Matthew', female: 'Danielle', defaultLocale: 'en-US' },
        'en-gb': { male: 'Brian', female: 'Amy', defaultLocale: 'en-GB' },
        'en-au': { male: 'Russell', female: 'Nicole', defaultLocale: 'en-AU' },
        'fr': { male: 'Remi', female: 'Lea', defaultLocale: 'fr-FR' },
        'fr-fr': { male: 'Remi', female: 'Lea', defaultLocale: 'fr-FR' },
        'fr-ca': { male: 'Liam', female: 'Gabrielle', defaultLocale: 'fr-CA' },
        'es': { male: 'Lucia', female: 'Lucia', defaultLocale: 'es-ES' },
        'es-es': { male: 'Enrique', female: 'Lucia', defaultLocale: 'es-ES' },
        'es-us': { male: 'Pedro', female: 'Lupe', defaultLocale: 'es-US' },
        'de': { male: 'Daniel', female: 'Vicki', defaultLocale: 'de-DE' },
        'it': { male: 'Adriano', female: 'Bianca', defaultLocale: 'it-IT' },
        'pt': { male: 'Thiago', female: 'Vitoria', defaultLocale: 'pt-BR' },
        'ja': { male: 'Takumi', female: 'Tomoko', defaultLocale: 'ja-JP' },
        'ar': { male: 'Zayd', female: 'Hala', defaultLocale: 'ar-AE' }
    };

    const match = voiceMap[rawLocale] || voiceMap[primaryLang];

    if (match) {
        return {
            voiceActor: isMale ? match.male : match.female,
            languageCode: match.defaultLocale
        };
    }

    return {
        voiceActor: isMale ? 'Matthew' : 'Danielle',
        languageCode: 'en-US'
    };
};

export const executeEnterpriseVoiceAgent = async ({ 
    toolInput, 
    env, 
    cognitoUserId, 
    clients, 
    sessionId 
}: ToolExecutionContext) => {
    const { 
        action, 
        destinationPhoneNumber, 
        objective, 
        dataToCapture, 
        voiceTone, 
        voiceGender, 
        languageCode,
        callId 
    } = toolInput;

    const VOICE_CALLS_TABLE = env.VOICE_AGENT_TRACKING_TABLE || 'VoiceAgentCallLogs';

    if (action === 'DISPATCH_CALL') {
        if (!destinationPhoneNumber || !objective) {
            return { 
                error: "Missing required parameters: destinationPhoneNumber and objective are required to dispatch a call.",
                additionalCreditsUsed: -2500 
            };
        }

        const instanceId = env.CONNECT_INSTANCE_ID;
        const contactFlowId = env.CONNECT_CONTACT_FLOW_ID;
        const sourcePhoneNumber = env.CONNECT_SOURCE_PHONE_NUMBER;

        if (!instanceId || !contactFlowId || !sourcePhoneNumber) {
            return { 
                error: "Platform Voice Error: Amazon Connect system environment variables are missing.",
                additionalCreditsUsed: -2500
            };
        }

        const formattedPhone = formatE164(destinationPhoneNumber);
        const internalCallId = `va_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const parsedDataToCapture = safeJsonArray(dataToCapture);

        const voiceConfig = resolveVoiceConfig(languageCode, voiceGender);

        try {
            await clients.dynamodb.send(new PutCommand({
                TableName: VOICE_CALLS_TABLE,
                Item: {
                    id: internalCallId,
                    userId: cognitoUserId,
                    parentSessionId: sessionId,
                    destinationPhoneNumber: formattedPhone,
                    objective,
                    dataToCapture: parsedDataToCapture,
                    voiceTone: voiceTone || 'professional',
                    voiceGender: voiceGender || 'FEMALE',
                    languageCode: voiceConfig.languageCode,
                    voiceActor: voiceConfig.voiceActor,
                    status: 'QUEUED',
                    createdAt: new Date().toISOString()
                }
            }));

            const connectClient = new ConnectClient({ 
                region: env.AWS_REGION || 'us-east-1',
                maxAttempts: 2 
            });
            
            const command = new StartOutboundVoiceContactCommand({
                DestinationPhoneNumber: formattedPhone,
                ContactFlowId: contactFlowId,
                InstanceId: instanceId,
                SourcePhoneNumber: sourcePhoneNumber,
                Attributes: {
                    internalCallId: internalCallId,
                    voiceTone: voiceTone || 'professional',
                    voiceGender: voiceGender || 'FEMALE',
                    languageCode: voiceConfig.languageCode,
                    voiceActor: voiceConfig.voiceActor
                }
            });

            const res = await connectClient.send(command);

            await clients.dynamodb.send(new UpdateCommand({
                TableName: VOICE_CALLS_TABLE,
                Key: { id: internalCallId },
                UpdateExpression: "SET #st = :status, providerCallId = :sid",
                ExpressionAttributeNames: { "#st": "status" },
                ExpressionAttributeValues: { ":status": "DISPATCHED", ":sid": res.ContactId }
            }));

            return {
                status: "Success",
                message: `Autonomous voice agent dispatched via Amazon Connect using voice '${voiceConfig.voiceActor}' (${voiceConfig.languageCode}). The call takes minutes to complete; use CHECK_CALL_RESULTS to retrieve outcomes later.`,
                callId: internalCallId
            };

        } catch (err: any) {
            try {
                await clients.dynamodb.send(new UpdateCommand({
                    TableName: VOICE_CALLS_TABLE,
                    Key: { id: internalCallId },
                    UpdateExpression: "SET #st = :status, failureReason = :err",
                    ExpressionAttributeNames: { "#st": "status" },
                    ExpressionAttributeValues: { ":status": "FAILED", ":err": err.message }
                }));
            } catch (dbErr) {
                console.error("Failed to mark call as FAILED in DynamoDB:", dbErr);
            }

            return { 
                error: `Voice Agent Dispatch Error: ${err.message}`,
                additionalCreditsUsed: -2500
            };
        }
    } 
    
    else if (action === 'CHECK_CALL_RESULTS') {
        if (!callId) {
            return { 
                error: "Missing required parameter: callId",
                additionalCreditsUsed: -2500
            };
        }

        try {
            const res = await clients.dynamodb.send(new GetCommand({
                TableName: VOICE_CALLS_TABLE,
                Key: { id: callId }
            }));

            if (!res.Item) {
                return { 
                    error: `Call ID ${callId} not found in tracking system.`,
                    additionalCreditsUsed: -2500
                };
            }

            const callData = res.Item;
            
            if (['QUEUED', 'DISPATCHED', 'IN_PROGRESS', 'RINGING'].includes(callData.status)) {
                return { 
                    status: "In Progress", 
                    message: "The AI agent is currently on the call or waiting for the recipient to answer. Please wait a minute and check back.",
                    additionalCreditsUsed: -2500
                };
            }

            const safeSummary = preserveBalancedSummary(callData.summary);

            return {
                status: callData.status,
                completionStatus: callData.completionStatus || (callData.status === 'COMPLETED' ? "Successfully completed objectives" : "Ended abruptly"),
                summary: safeSummary,
                capturedData: callData.capturedData || {},
                actionItems: callData.actionItems || [],
                additionalCreditsUsed: -2500
            };
        } catch (err: any) {
            return { 
                error: `Failed to retrieve call results: ${err.message}`,
                additionalCreditsUsed: -2500
            };
        }
    }

    else if (action === 'GET_CALL_TRANSCRIPT') {
        if (!callId) {
            return { error: "Missing required parameter: callId", additionalCreditsUsed: -2500 };
        }

        try {
            const res = await clients.dynamodb.send(new GetCommand({
                TableName: VOICE_CALLS_TABLE,
                Key: { id: callId }
            }));

            if (!res.Item || !res.Item.transcript) {
                return { 
                    error: `No transcript available for Call ID ${callId}.`,
                    additionalCreditsUsed: -2500 
                };
            }

            const rawTranscript: Array<{ speaker: string; text: string; timestamp?: string }> = 
                Array.isArray(res.Item.transcript) ? res.Item.transcript : [];

            const { searchQuery, page = 1 } = toolInput;
            const pageSize = 30;

            let filteredTranscript = rawTranscript;

            if (searchQuery) {
                const term = searchQuery.toLowerCase();
                filteredTranscript = rawTranscript.filter(turn => 
                    turn.text.toLowerCase().includes(term)
                );
            }

            const totalTurns = filteredTranscript.length;
            const startIndex = (Math.max(1, page) - 1) * pageSize;
            const paginatedTurns = filteredTranscript.slice(startIndex, startIndex + pageSize);

            return {
                status: "Success",
                callId,
                totalTurns,
                page,
                totalPages: Math.ceil(totalTurns / pageSize),
                transcript: paginatedTurns,
                additionalCreditsUsed: -2500 
            };
        } catch (err: any) {
            return { 
                error: `Failed to retrieve call transcript: ${err.message}`,
                additionalCreditsUsed: -2500 
            };
        }
    }

    return { 
        error: `Unsupported action: ${action}`,
        additionalCreditsUsed: -2500 
    };
};