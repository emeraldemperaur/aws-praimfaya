import axios from "axios";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE_NAME!;

interface BedrockFunctionEvent {
    messageVersion: string;
    agent: { name: string; id: string; alias: string; version: string; };
    actionGroup: string;
    function: string;
    parameters: Array<{ name: string; type: string; value: string; }>;
}

export const handler = async (event: BedrockFunctionEvent) => {
    console.log(`Bedrock Agent invoking function: ${event.function}`);

    try {
        const workflowIdParam = event.parameters?.find(p => p.name === 'workflowId');
        const payloadParam = event.parameters?.find(p => p.name === 'payloadJson');

        if (!workflowIdParam?.value) throw new Error("Missing required parameter: workflowId");

        const workflowId = workflowIdParam.value;
        const payload = payloadParam?.value ? JSON.parse(payloadParam.value) : {};

        const wfRes = await dynamodb.send(new GetCommand({
            TableName: WORKFLOWS_TABLE,
            Key: { id: workflowId }
        }));

        const triggerUrl = wfRes.Item?.triggerURL;
        const authHeader = wfRes.Item?.authHeader; 
        const callbackUrl = wfRes.Item?.callbackURL;

        if (!triggerUrl) throw new Error(`Workflow ID ${workflowId} not found or missing triggerURL`);

        if (callbackUrl) {
            payload.callbackUrl = callbackUrl;
            payload.callback_url = callbackUrl;
        }

        const headers: Record<string, string> = { 
            'Content-Type': 'application/json' 
        };
        
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await axios.post(triggerUrl, payload, {
            headers: headers,
            timeout: 15000
        });

        return formatResponse(event, 200, { status: "success", data: response.data });

    } catch (error: any) {
        console.error("Dynamic Webhook execution failed:", error);
        return formatResponse(event, 500, { status: "error", message: error.message });
    }
};

function formatResponse(event: BedrockFunctionEvent, statusCode: number, body: any) {
    return {
        messageVersion: "1.0",
        response: {
            actionGroup: event.actionGroup,
            function: event.function,
            functionResponse: {
                responseBody: {
                    "TEXT": {
                        body: JSON.stringify(body)
                    }
                }
            }
        }
    };
}