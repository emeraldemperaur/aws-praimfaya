import { BedrockRuntimeClient, GetAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import type { Schema } from '../../data/resource';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-west-2' });

export const handler: Schema["pollBedrockAsyncJob"]["functionHandler"] = async (event) => {
    try {
        const { invocationArn } = event.arguments;
        
        const command = new GetAsyncInvokeCommand({ invocationArn });
        const response = await bedrockClient.send(command);
        
        return JSON.stringify({
            status: response.status, // "InProgress" | "Completed" | "Failed"
            failureMessage: response.failureMessage || null
        });
    } catch (error: any) {
        console.error("Failed to poll Bedrock:", error);
        throw new Error("Polling execution failed");
    }
};