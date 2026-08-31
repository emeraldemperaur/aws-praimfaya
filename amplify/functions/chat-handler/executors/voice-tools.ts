import { ConnectClient, StartOutboundVoiceContactCommand } from "@aws-sdk/client-connect";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ToolExecutionContext } from './types';

export const executeEnterpriseVoiceAgent = async ({ toolInput, env, cognitoUserId, clients }: ToolExecutionContext) => {
    const { 
        action, 
        destinationPhoneNumber, 
        objective, 
        dataToCapture, 
        voiceTone, 
        voiceGender, 
        callId 
    } = toolInput;

    const VOICE_CALLS_TABLE = env.VOICE_AGENT_TRACKING_TABLE || 'VoiceAgentCallLogs';

    
    if (action === 'DISPATCH_CALL') {
        if (!destinationPhoneNumber || !objective) {
            return { error: "Missing required parameters: destinationPhoneNumber and objective are required to dispatch a call." };
        }

        const internalCallId = `va_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        try {
            await clients.dynamodb.send(new PutCommand({
                TableName: VOICE_CALLS_TABLE,
                Item: {
                    id: internalCallId,
                    userId: cognitoUserId,
                    destinationPhoneNumber,
                    objective,
                    dataToCapture: dataToCapture || [],
                    voiceTone: voiceTone || 'professional',
                    voiceGender: voiceGender || 'FEMALE',
                    status: 'QUEUED',
                    createdAt: new Date().toISOString()
                }
            }));

            const instanceId = env.CONNECT_INSTANCE_ID;
            const contactFlowId = env.CONNECT_CONTACT_FLOW_ID;
            const sourcePhoneNumber = env.CONNECT_SOURCE_PHONE_NUMBER;

            if (!instanceId || !contactFlowId || !sourcePhoneNumber) {
                return { error: "Platform Voice Error: Amazon Connect system environment variables are missing." };
            }

            const connectClient = new ConnectClient({ region: env.AWS_REGION || 'us-east-1' });
            
            const command = new StartOutboundVoiceContactCommand({
                DestinationPhoneNumber: destinationPhoneNumber,
                ContactFlowId: contactFlowId,
                InstanceId: instanceId,
                SourcePhoneNumber: sourcePhoneNumber,
                Attributes: {
                    internalCallId: internalCallId,
                    voiceTone: voiceTone || 'professional',
                    voiceGender: voiceGender || 'FEMALE'
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
                message: "Autonomous voice agent dispatched via Amazon Connect. The call takes minutes to complete; use CHECK_CALL_RESULTS to retrieve outcomes later.",
                callId: internalCallId
            };

        } catch (err: any) {
            return { error: `Voice Agent Dispatch Error: ${err.message}` };
        }
    } 
    
  
    else if (action === 'CHECK_CALL_RESULTS') {
        if (!callId) return { error: "Missing required parameter: callId" };

        try {
            const res = await clients.dynamodb.send(new GetCommand({
                TableName: VOICE_CALLS_TABLE,
                Key: { id: callId }
            }));

            if (!res.Item) {
                return { error: `Call ID ${callId} not found in tracking system.` };
            }

            const callData = res.Item;
            
            if (['QUEUED', 'DISPATCHED', 'IN_PROGRESS', 'RINGING'].includes(callData.status)) {
                return { 
                    status: "In Progress", 
                    message: "The AI agent is currently on the call or waiting for the recipient to answer. Please wait a minute and check back." 
                };
            }

            return {
                status: callData.status,
                completionStatus: callData.completionStatus || (callData.status === 'COMPLETED' ? "Successfully completed objectives" : "Ended abruptly"),
                summary: callData.summary || "No summary available.",
                capturedData: callData.capturedData || {}
            };
        } catch (err: any) {
            return { error: `Failed to retrieve call results: ${err.message}` };
        }
    }

    return { error: `Unsupported action: ${action}` };
};