import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const TERMINAL_MESSAGES_TABLE = process.env.TERMINAL_MESSAGES_TABLE_NAME!;
const WORKER_FUNCTION = process.env.AGENT_WORKER_FUNCTION_NAME!;

export const handler = async (event: any) => {
    try {
        const args = event.arguments || event;
        const profileId = args.profileId;
        const userMessage = args.prompt || args.userMessage; 
        const cognitoUserId = args.cognitoUserId || event.identity?.claims?.sub;
        
        const sessionId = args.sessionId || `session-${Date.now()}`;
        const terminalId = args.terminalId || sessionId;

        if (!profileId || !userMessage || !cognitoUserId) {
            return JSON.stringify({ error: "Missing required parameters: profileId, userMessage, and cognitoUserId are required." });
        }

        const userRes = await dynamodb.send(new GetCommand({ TableName: USER_PROFILES_TABLE, Key: { cognitoUserId } }));
        if (!userRes.Item || (userRes.Item.computeCredits ?? 0) <= 0) {
            return JSON.stringify({ error: "INSUFFICIENT_CREDITS: Your compute credit balance is exhausted. Please top up to continue." });
        }

        const messageId = `msg_usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await dynamodb.send(new PutCommand({
            TableName: TERMINAL_MESSAGES_TABLE,
            Item: {
                id: messageId,
                terminalId: terminalId,
                role: 'USER',
                content: userMessage,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }));

        await lambdaClient.send(new InvokeCommand({
            FunctionName: WORKER_FUNCTION,
            InvocationType: 'Event', 
            Payload: Buffer.from(JSON.stringify({
                profileId,
                prompt: userMessage,
                cognitoUserId,
                sessionId,
                terminalId,
                ephemeralSecretsJson: args.ephemeralSecretsJson,
                chatHistory: args.chatHistory,
                userProfile: userRes.Item 
            }))
        }));

        return JSON.stringify({ 
            status: "PROCESSING", 
            answer: "", 
            citations: [], 
            requestedCredentials: [] 
        });

    } catch (error: any) {
        console.error("Fast-ACK Ingestion Error:", error);
        return JSON.stringify({ error: `System Failure: ${error.message}` });
    }
};