import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const PROFILES_TABLE = process.env.PROFILES_TABLE_NAME!;
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE_NAME!;
const PROFILE_WORKFLOWS_TABLE = process.env.PROFILE_WORKFLOWS_TABLE_NAME!;
const WEBHOOK_ROUTER_ARN = process.env.WEBHOOK_ROUTER_LAMBDA_ARN!;

interface CachedTools {
    tools: any[];
    expiresAt: number;
}
const mcpToolCache: Record<string, CachedTools> = {};
const MCP_CACHE_TTL_MS = 1000 * 60 * 15; 

interface ChatHandlerEvent {
    profileId: string;
    userMessage: string;
    chatHistory?: string; 
}

export const handler = async (event: ChatHandlerEvent) => {
    console.log(`Processing chat for Profile ID: ${event.profileId}`);

    try {
        if (!event.profileId || !event.userMessage) {
            throw new Error("Missing required parameters: profileId or userMessage");
        }

        const history = event.chatHistory ? JSON.parse(event.chatHistory) : [];

        const profileRes = await dynamodb.send(new GetCommand({
            TableName: PROFILES_TABLE,
            Key: { id: event.profileId }
        }));

        const profile = profileRes.Item;
        if (!profile) throw new Error(`Context Profile ${event.profileId} not found`);

        let systemPrompt = profile.systemPrompt || "You are a helpful AI assistant.";

        if (profile.vectorCollectionId) {
            console.log(`Executing RAG query against Knowledge Base: ${profile.vectorCollectionId}`);
            try {
                const retrieveResponse = await bedrockAgentRuntime.send(new RetrieveCommand({
                    knowledgeBaseId: profile.vectorCollectionId,
                    retrievalQuery: { text: event.userMessage },
                    retrievalConfiguration: {
                        vectorSearchConfiguration: {
                            numberOfResults: 5
                        }
                    }
                }));

                const ragChunks = retrieveResponse.retrievalResults
                    ?.map(r => r.content?.text)
                    .filter(Boolean) || [];

                if (ragChunks.length > 0) {
                    systemPrompt += `\n\n### ENTERPRISE KNOWLEDGE BASE CONTEXT ###\n`;
                    systemPrompt += `Use the following retrieved context to help answer the user's question:\n`;
                    ragChunks.forEach((chunk, idx) => {
                        systemPrompt += `\n[Reference ${idx + 1}]:\n${chunk}\n`;
                    });
                }
            } catch (kbError) {
                console.error("Knowledge Base retrieval failed. Continuing with base prompt.", kbError);
            }
        }

        const assignedWorkflows = await getAssignedWorkflows(profile.id);
        
        const workflowTools = assignedWorkflows.map(wf => ({
            toolSpec: {
                name: sanitizeToolName(`wf_${wf.id}`),
                description: `${wf.name}: ${wf.description || 'No description provided'}`,
                inputSchema: {
                    json: buildJsonSchemaFromParams(wf.inputParameters)
                }
            }
        }));

        let mcpTools: any[] = [];
        if (profile.role === 'STANDARD' && profile.customMcpUrl) {
            mcpTools = await fetchMcpToolsWithCache(profile.customMcpUrl);
        }

        const allTools = [...workflowTools, ...mcpTools];
        const toolConfig = allTools.length > 0 ? { tools: allTools } : undefined;

        const messages = [...history, { role: "user", content: [{ text: event.userMessage }] }];

        let converseResponse = await bedrockRuntime.send(new ConverseCommand({
            modelId: profile.llmModelId || "amazon.nova-micro-v1:0",
            messages: messages,
            system: [{ text: systemPrompt }],
            toolConfig: toolConfig,
            inferenceConfig: {
                temperature: profile.temperature ?? 0.7
            }
        }));

        const outputMessage = converseResponse.output?.message;
        const toolUseBlocks = outputMessage?.content?.filter(block => block.toolUse) || [];

        if (toolUseBlocks.length > 0) {
            console.log(`Model requested ${toolUseBlocks.length} tool executions`);
            messages.push(outputMessage!);
            const toolResults = [];

            for (const block of toolUseBlocks) {
                const toolUse = block.toolUse!;
                if (!toolUse.name || !toolUse.toolUseId) {
                    console.warn("Bedrock returned a malformed toolUse block.");
                    continue;
                }

                let executionResult: any;

                // BRANCH A: AUTOMATION WORKFLOW TOOL
                if (toolUse.name.startsWith('wf_')) {
                    const matchedWf = assignedWorkflows.find(
                        wf => sanitizeToolName(`wf_${wf.id}`) === toolUse.name
                    );

                    if (matchedWf) {
                        console.log(`Executing Workflow ID: ${matchedWf.id} via Webhook Router`);
                        executionResult = await invokeWebhookRouter(matchedWf.id, toolUse.input);
                    } else {
                        executionResult = { error: `Workflow tool ${toolUse.name} not found in database.` };
                    }
                } 
                // BRANCH B: CUSTOM MCP SERVER TOOL
                else if (profile.customMcpUrl) {
                    console.log(`Executing MCP Tool '${toolUse.name}' via ${profile.customMcpUrl}`);
                    executionResult = await executeMcpTool(profile.customMcpUrl, toolUse.name, toolUse.input);
                }

                toolResults.push({
                    toolResult: {
                        toolUseId: toolUse.toolUseId,
                        content: [{ text: JSON.stringify(executionResult) }],
                        status: executionResult?.error ? "error" : "success"
                    }
                });
            }

            messages.push({ role: "user", content: toolResults });

            converseResponse = await bedrockRuntime.send(new ConverseCommand({
                modelId: profile.llmModelId || "amazon.nova-micro-v1:0",
                messages: messages,
                system: [{ text: systemPrompt }]
            }));
        }

        const responseText = converseResponse.output?.message?.content?.[0]?.text || "No response text generated.";

        return {
            statusCode: 200,
            body: JSON.stringify({
                text: responseText,
                chatHistory: messages 
            })
        };

    } catch (error: any) {
        console.error("Chat Handler Execution Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "An unexpected chat error occurred." })
        };
    }
};

async function invokeWebhookRouter(workflowId: string, payload: any) {
    try {
        const command = new InvokeCommand({
            FunctionName: WEBHOOK_ROUTER_ARN,
            Payload: Buffer.from(JSON.stringify({
                parameters: [
                    { name: 'workflowId', value: workflowId },
                    { name: 'payloadJson', value: JSON.stringify(payload) }
                ]
            }))
        });

        const res = await lambdaClient.send(command);
        const responsePayload = JSON.parse(Buffer.from(res.Payload!).toString());
        
        if (responsePayload?.response?.functionResponse?.responseBody?.TEXT?.body) {
            return JSON.parse(responsePayload.response.functionResponse.responseBody.TEXT.body);
        }
        return responsePayload;
    } catch (err: any) {
        console.error("Failed to invoke webhook router:", err);
        return { error: err.message };
    }
}

async function getAssignedWorkflows(profileId: string) {
    const mappingRes = await dynamodb.send(new QueryCommand({
        TableName: PROFILE_WORKFLOWS_TABLE,
        IndexName: 'byProfile',
        KeyConditionExpression: 'contextProfileId = :pid',
        ExpressionAttributeValues: { ':pid': profileId }
    }));

    const workflowIds = mappingRes.Items?.map(item => item.contextWorkflowId) || [];
    const workflows = [];

    for (const wId of workflowIds) {
        const wfRes = await dynamodb.send(new GetCommand({
            TableName: WORKFLOWS_TABLE,
            Key: { id: wId }
        }));
        if (wfRes.Item && !wfRes.Item.archived) workflows.push(wfRes.Item);
    }
    return workflows;
}

async function fetchMcpToolsWithCache(mcpUrl: string): Promise<any[]> {
    const now = Date.now();

    if (mcpToolCache[mcpUrl] && mcpToolCache[mcpUrl].expiresAt > now) {
        return mcpToolCache[mcpUrl].tools;
    }

    try {
        const res = await axios.post(`${mcpUrl}/tools/list`, {}, { timeout: 3000 });
        const mcpTools = res.data?.tools || [];

        const translatedTools = mcpTools.map((t: any) => ({
            toolSpec: {
                name: sanitizeToolName(t.name),
                description: t.description || '',
                inputSchema: { json: t.inputSchema || { type: "object", properties: {} } }
            }
        }));

        mcpToolCache[mcpUrl] = {
            tools: translatedTools,
            expiresAt: now + MCP_CACHE_TTL_MS
        };

        return translatedTools;
    } catch (err) {
        console.error(`Failed to fetch tools from custom MCP server (${mcpUrl}):`, err);
        return [];
    }
}

async function executeMcpTool(mcpUrl: string, toolName: string, args: any) {
    try {
        const res = await axios.post(`${mcpUrl}/tools/call`, {
            name: toolName,
            arguments: args
        }, { timeout: 15000 });

        return res.data;
    } catch (err: any) {
        console.error(`MCP tool execution failed (${toolName}):`, err);
        return { error: err.message };
    }
}

function mapToBedrockType(uiType?: string): string {
    if (!uiType) return "string";
    switch (uiType.toLowerCase()) {
        case 'number':
        case 'float':
            return "number";
        case 'boolean':
            return "boolean";
        case 'array':
        case 'tuple':
            return "array";
        case 'object':
            return "object";
        case 'date':
        case 'datetime':
        case 'string':
        default:
            return "string";
    }
}

function buildJsonSchemaFromParams(inputParameters?: any[]) {
    if (!inputParameters || inputParameters.length === 0) {
        return { type: "object", properties: {} };
    }

    const properties: Record<string, any> = {};
    const required: string[] = [];

    inputParameters.forEach(param => {
        const bedrockType = mapToBedrockType(param.type);
        
        properties[param.variable] = {
            type: bedrockType,
            description: `Input parameter: ${param.variable} (Format: ${param.type || 'String'})`
        };
        if (param.isRequired) required.push(param.variable);
    });

    return {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined
    };
}

function sanitizeToolName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 64);
}