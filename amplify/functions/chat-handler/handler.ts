import { BedrockRuntimeClient, ConverseCommand, StartAsyncInvokeCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PollyClient } from "@aws-sdk/client-polly";
import { S3Client } from "@aws-sdk/client-s3";
import axios from "axios";
import { CORE_SYSTEM_TOOLS, isValidUrl, NATIVE_TOOLS_REGISTRY } from "./tool-registry";
import { TOOL_EXECUTORS } from "./executors";
import { MODEL_CREDIT_MULTIPLIERS } from "./model-credit-multipliers";

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const PROFILES_TABLE = process.env.PROFILES_TABLE_NAME!;
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE_NAME!;
const PROFILE_WORKFLOWS_TABLE = process.env.PROFILE_WORKFLOWS_TABLE_NAME!;
const WEBHOOK_ROUTER_ARN = process.env.WEBHOOK_ROUTER_LAMBDA_ARN!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const workflowEmbeddingCache: Record<string, number[]> = {};
const nativeToolEmbeddingCache: Record<string, number[]> = {};

const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { "generate_luma_video": 150000, "generate_audio": 500, "generate_image": 30000, "generate_enterprise_image": 4000, "edit_image": 15000, "enterprise_voice_agent": 2500 };


export const handler = async (event: any) => {
    try {
        const args = event.arguments || event;
        const profileId = args.profileId;
        const userMessage = args.prompt || args.userMessage; 
        const cognitoUserId = args.cognitoUserId || event.identity?.claims?.sub;
        
        const ephemeralSecrets = args.ephemeralSecretsJson ? JSON.parse(args.ephemeralSecretsJson) : {};

        if (!profileId || !userMessage || !cognitoUserId) {
            throw new Error("Missing required parameters in event arguments");
        }

        const userRes = await dynamodb.send(new GetCommand({ TableName: USER_PROFILES_TABLE, Key: { cognitoUserId } }));
        if (!userRes.Item || (userRes.Item.computeCredits ?? 0) <= 0) return { statusCode: 402, body: JSON.stringify({ error: "INSUFFICIENT_CREDITS" }) };

        const history = args.chatHistory ? JSON.parse(args.chatHistory) : [];
        const profileRes = await dynamodb.send(new GetCommand({ TableName: PROFILES_TABLE, Key: { id: profileId } }));
        const profile = profileRes.Item;
        if (!profile) throw new Error(`Context Profile not found`);

        const targetModelId = profile.llmModelId || "amazon.nova-pro-v1:0";
        const multiplier = MODEL_CREDIT_MULTIPLIERS[targetModelId] || 2;
        const computeCredits = userRes.Item.computeCredits ?? 0;
        const historyString = JSON.stringify(history);
        const systemPromptStr = profile.systemPrompt || "";
        const estimatedInputTokens = Math.ceil((userMessage.length + historyString.length + systemPromptStr.length + 1000) / 4);
        const minimumCreditsNeeded = estimatedInputTokens * multiplier;

        if (computeCredits < minimumCreditsNeeded) {
            return { 
                statusCode: 402, 
                body: JSON.stringify({ error: `INSUFFICIENT_CREDITS: Your prompt and chat history require at least ${minimumCreditsNeeded} credits to process. You only have ${computeCredits} available. Please top up or start a new session.` }) 
            };
        }

        const maxAffordableOutputTokens = Math.floor((computeCredits - minimumCreditsNeeded) / multiplier);
        if (maxAffordableOutputTokens <= 5) {
            return { statusCode: 402, body: JSON.stringify({ error: "INSUFFICIENT_CREDITS: Balance too low to generate a response." }) };
        }

        const citations: any[] = []; 
        let requestedCredentials: string[] = [];

        // ================================================
        // Managed Agent (Supervisor & Collaborator Agents)
        // ================================================
        if (profile.role === 'SUPERVISOR' && profile.awsAgentId && profile.awsAliasId) {
            try {
                const safeSessionId = cognitoUserId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) + "-session";
                const dynamicPrompt = profile.systemPrompt || "You are an enterprise supervisor agent.";
                
                const invokeAgentRes = await bedrockAgentRuntime.send(new InvokeAgentCommand({
                    agentId: profile.awsAgentId,
                    agentAliasId: profile.awsAliasId,
                    sessionId: safeSessionId,
                    inputText: userMessage,
                    enableTrace: false,
                    sessionState: {
                        sessionAttributes: {
                            userId: cognitoUserId,
                            terminalId: args.sessionId || safeSessionId,
                            terminalTitle: profile.title || 'Managed Agent Session',
                            contextProfileName: profile.name || 'Supervisor Agent',
                            contextProfileId: profile.id,
                        },
                        promptSessionAttributes: {
                            "dynamicSystemPrompt": dynamicPrompt
                        }
                    }
                }));

                let agentResponse = "";
                let streamCost = minimumCreditsNeeded;
                for await (const streamEvent of invokeAgentRes.completion || []) {
                    if (streamEvent.chunk?.bytes) {
                        agentResponse += new TextDecoder("utf-8").decode(streamEvent.chunk.bytes);

                        const currentOutputTokens = Math.ceil(agentResponse.length / 4);
                        streamCost = (estimatedInputTokens + currentOutputTokens) * multiplier;
                        if (streamCost >= computeCredits) {
                            agentResponse += "\n\n[SYSTEM: EXECUTION HALTED - COMPUTE CREDITS EXHAUSTED. PLEASE TOP UP TO CONTINUE.]";
                            break; 
                        }
                    }
                }

                const authRegex = /<vanguard_auth_request>(.*?)<\/vanguard_auth_request>/g;
                let match;
                while ((match = authRegex.exec(agentResponse)) !== null) {
                    requestedCredentials.push(match[1].toLowerCase().trim());
                }
                
                const cleanResponse = agentResponse.replace(authRegex, '').trim();

                const outputTokens = Math.ceil(cleanResponse.length / 4);
                const llmCost = Math.ceil((estimatedInputTokens + outputTokens) * multiplier);
                
                if (llmCost > 0) {
                    await recordUsageTransaction(cognitoUserId, llmCost, {
                        sessionId: args.sessionId || safeSessionId,
                        sessionTitle: profile.title || 'Managed Agent Session',
                        actionType: 'LLM_INFERENCE', 
                        modelId: targetModelId,
                        inputTokens: estimatedInputTokens,
                        outputTokens: outputTokens
                    });
                }

                return JSON.stringify({ 
                    answer: cleanResponse, 
                    citations: [], 
                    requestedCredentials: requestedCredentials, 
                    tokenUsage: { inputTokens: estimatedInputTokens, outputTokens } 
                });

            } catch (err: any) {
                return JSON.stringify({ error: `Managed Agent Execution Failed: ${err.message}` });
            }
        }

        // ================================================
        // Standard Agent (Workflow Routing + Native Tools)
        // ================================================
        let systemPrompt = profile.systemPrompt || "You are a helpful AI assistant.";
        systemPrompt += `\n\n[CRITICAL ROUTING DIRECTIVE]: You act as an intelligent workflow coordinator. Evaluate if an automation workflow (wf_) can fulfill the user's overarching intent first before cascading down to Native Tools. 
        Note that workflow descriptions contain a [Priority: X/10] indicator; if multiple workflows are relevant, heavily favor the one with the highest user-specified priority.`;

        const llmTemperature = profile.temperature !== undefined && profile.temperature !== null ? profile.temperature : 0.7;

        // RAG EXECUTION
        if (profile.vectorCollectionId) {
            try {
                const retrieveResponse = await bedrockAgentRuntime.send(new RetrieveCommand({
                    knowledgeBaseId: profile.vectorCollectionId,
                    retrievalQuery: { text: userMessage },
                    retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 5 } }
                }));
                const ragChunks = retrieveResponse.retrievalResults?.map(r => r.content?.text).filter(Boolean) || [];
                if (ragChunks.length > 0) {
                    systemPrompt += `\n\n### ENTERPRISE KNOWLEDGE BASE CONTEXT ###\n`;
                    ragChunks.forEach((chunk, idx) => systemPrompt += `\n[Reference ${idx + 1}]:\n${chunk}\n`);
                    citations.push({ type: 'document', uri: `Knowledge Base Retrieval (${ragChunks.length} chunks)` });
                }
            } catch (kbError) { console.error("Knowledge Base retrieval failed.", kbError); }
        }

        const userQueryVector = await getEmbedding(userMessage);

        const assignedWorkflows = await getAssignedWorkflows(profile.id);
        let relevantWorkflows = assignedWorkflows;

        if (assignedWorkflows.length > 0 && userQueryVector.length > 0) {
            const scoredWorkflows = await Promise.all(
                assignedWorkflows.map(async (wf) => {
                    let v = workflowEmbeddingCache[wf.id];
                    if (!v) { v = await getEmbedding(`${wf.name}: ${wf.description || ''}`); if (v.length > 0) workflowEmbeddingCache[wf.id] = v; }
                    return { wf, similarity: cosineSimilarity(userQueryVector, v) };
                })
            );
            scoredWorkflows.sort((a, b) => b.similarity - a.similarity);
            relevantWorkflows = scoredWorkflows.filter(item => item.similarity >= 0.25).slice(0, 3).map(item => item.wf);
        }

        const workflowTools = relevantWorkflows.map(wf => ({
            toolSpec: { name: sanitizeToolName(`wf_${wf.id}`), description: wf.description || '', inputSchema: { json: buildJsonSchemaFromParams(wf.inputParameters) } }
        }));

        const allowedNativeTools = NATIVE_TOOLS_REGISTRY.filter(tool => {
            if (tool.toolSpec.name === 'mito_mcp_agent' && !profile.enableMitoMcp) return false;
            if (tool.toolSpec.name === 'apotheosis_mcp_agent' && !profile.enableApotheosisMcp) return false;
            if (tool.toolSpec.name === 'byo_mcp_agent') {
                if (!profile.customMcpUrl || profile.customMcpUrl.trim() === '' || !isValidUrl(profile.customMcpUrl)) { return false;}
            }
            return true;
        });

        let relevantNativeTools = allowedNativeTools;
        if (userQueryVector.length > 0) {
            const scoredNativeTools = await Promise.all(
                NATIVE_TOOLS_REGISTRY.map(async (tool) => {
                    let v = nativeToolEmbeddingCache[tool.toolSpec.name];
                    if (!v) { v = await getEmbedding(`${tool.toolSpec.name}: ${tool.toolSpec.description}`); if (v.length > 0) nativeToolEmbeddingCache[tool.toolSpec.name] = v; }
                    return { tool, similarity: cosineSimilarity(userQueryVector, v) };
                })
            );
            scoredNativeTools.sort((a, b) => b.similarity - a.similarity);
            relevantNativeTools = scoredNativeTools.filter(item => item.similarity >= 0.20).slice(0, 6).map(item => item.tool);
        }

        const allTools = [...workflowTools, ...CORE_SYSTEM_TOOLS, ...relevantNativeTools];
        const toolConfig = allTools.length > 0 ? { tools: allTools as any[] } : undefined;
        const messages = [...history, { role: "user", content: [{ text: userMessage }] }];

        let totalInboundTokens = 0; let totalOutboundTokens = 0; let flatToolCredits = 0;
        const safeMaxTokens = Math.max(1, Math.min(8192, Math.floor((computeCredits - (estimatedInputTokens * multiplier)) / multiplier)));

        let converseResponse = await bedrockRuntime.send(new ConverseCommand({
            modelId: targetModelId, 
            messages: messages, 
            system: [{ text: systemPrompt }], 
            toolConfig: toolConfig,
            inferenceConfig: { 
                temperature: llmTemperature,
                maxTokens: safeMaxTokens
             }
        }));

        totalInboundTokens += converseResponse.usage?.inputTokens || 0;
        totalOutboundTokens += converseResponse.usage?.outputTokens || 0;

        const outputMessage = converseResponse.output?.message;
        const toolUseBlocks = outputMessage?.content?.filter(block => block.toolUse) || [];

        if (toolUseBlocks.length > 0) {
            messages.push(outputMessage!);
            const toolResults = [];

            for (const block of toolUseBlocks) {
                const toolUse = block.toolUse!;
                if (!toolUse.name || !toolUse.toolUseId) continue;
                
                const toolInput: any = toolUse.input || {};
                let executionResult: any;

                if (MULTIMODAL_TOOL_FLAT_COSTS[toolUse.name]) flatToolCredits += MULTIMODAL_TOOL_FLAT_COSTS[toolUse.name];

                if (toolUse.name === 'request_secure_credentials') {
                    requestedCredentials.push(toolInput.serviceName?.toLowerCase());
                    executionResult = { status: "Success. The frontend is displaying a secure credential prompt. Tell the user you are waiting for them." };
                }
                
                else if (TOOL_EXECUTORS[toolUse.name]) {
                    try {
                        const context = {
                            toolInput,
                            ephemeralSecrets,
                            profile,
                            cognitoUserId,
                            sessionId: args.sessionId || `session-${Date.now()}`,
                            citations,
                            clients: { 
                                s3: s3Client, 
                                polly: pollyClient, 
                                bedrockRuntime: bedrockRuntime,
                                dynamodb: dynamodb,       
                                lambda: lambdaClient      
                             },
                            env: process.env as Record<string, string>
                        };
                        
                        executionResult = await TOOL_EXECUTORS[toolUse.name](context);
                    } catch (err: any) {
                        executionResult = { error: `Tool Execution Error: ${err.message}` };
                    }
                } 

                else if (toolUse.name.startsWith('wf_')) {
                    const matchedWf = assignedWorkflows.find(wf => sanitizeToolName(`wf_${wf.id}`) === toolUse.name);
                    executionResult = matchedWf ? await invokeWebhookRouter(matchedWf.id, toolInput) : { error: "Workflow not found." };
                } 
                else if (profile.customMcpUrl) {
                    executionResult = await executeMcpTool(profile.customMcpUrl, toolUse.name, toolInput);
                }

                toolResults.push({ toolResult: { toolUseId: toolUse.toolUseId, content: [{ text: JSON.stringify(executionResult) }], status: executionResult?.error ? "error" : "success" } });
            }

            messages.push({ role: "user", content: toolResults });
            
            converseResponse = await bedrockRuntime.send(new ConverseCommand({ 
                modelId: targetModelId, 
                messages: messages, 
                system: [{ text: systemPrompt }],
                inferenceConfig: { temperature: llmTemperature }
             }));
            totalInboundTokens += converseResponse.usage?.inputTokens || 0;
            totalOutboundTokens += converseResponse.usage?.outputTokens || 0;
        }

        const responseText = converseResponse.output?.message?.content?.[0]?.text || "No response generated.";
        const totalDeduction = Math.ceil((totalInboundTokens + totalOutboundTokens) * multiplier) + flatToolCredits;

        if (totalDeduction > 0) {
            await recordUsageTransaction(cognitoUserId, totalDeduction, {
                sessionId: args.sessionId || 'unknown-session',
                sessionTitle: profile.title,
                actionType: 'LLM_INFERENCE', 
                modelId: targetModelId,
                inputTokens: totalInboundTokens,
                outputTokens: totalOutboundTokens
            });
        }
  
        return JSON.stringify({ 
            answer: responseText,          
            citations: citations,          
            requestedCredentials: requestedCredentials, 
            tokenUsage: { inputTokens: totalInboundTokens, outputTokens: totalOutboundTokens }
        });

    } catch (error: any) {
        return JSON.stringify({ error: error.message || "An unexpected error occurred." });
    }
};

async function getEmbedding(text: string): Promise<number[]> { try { const res = await bedrockRuntime.send(new InvokeModelCommand({ modelId: "amazon.titan-embed-text-v2:0", contentType: "application/json", accept: "application/json", body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }) })); return JSON.parse(new TextDecoder().decode(res.body)).embedding || []; } catch { return []; } }
function cosineSimilarity(a: number[], b: number[]): number { if (!a.length || !b.length || a.length !== b.length) return 0; let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }
async function invokeWebhookRouter(id: string, payload: any) { try { const res = await lambdaClient.send(new InvokeCommand({ FunctionName: WEBHOOK_ROUTER_ARN, Payload: Buffer.from(JSON.stringify({ parameters: [{ name: 'workflowId', value: id }, { name: 'payloadJson', value: JSON.stringify(payload) }] })) })); const out = JSON.parse(Buffer.from(res.Payload!).toString()); return out?.response?.functionResponse?.responseBody?.TEXT?.body ? JSON.parse(out.response.functionResponse.responseBody.TEXT.body) : out; } catch (err: any) { return { error: err.message }; } }
async function getAssignedWorkflows(pid: string) { const m = await dynamodb.send(new QueryCommand({ TableName: PROFILE_WORKFLOWS_TABLE, IndexName: 'byProfile', KeyConditionExpression: 'contextProfileId = :pid', ExpressionAttributeValues: { ':pid': pid } })); const wfs = []; for (const wId of (m.Items?.map(i => i.contextWorkflowId) || [])) { const r = await dynamodb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { id: wId } })); if (r.Item && !r.Item.archived) wfs.push(r.Item); } return wfs; }
async function executeMcpTool(url: string, name: string, args: any) { try { const res = await axios.post(`${url}/tools/call`, { name, arguments: args }, { timeout: 15000 }); return res.data; } catch (err: any) { return { error: err.message }; } }
function mapToBedrockType(t?: string): string { switch (t?.toLowerCase()) { case 'number': case 'float': return 'number'; case 'boolean': return 'boolean'; case 'array': return 'array'; case 'object': return 'object'; default: return 'string'; } }
function buildJsonSchemaFromParams(params?: any[]) { if (!params || !params.length) return { type: "object", properties: {} }; const props: any = {}; const req: string[] = []; params.forEach(p => { props[p.variable] = { type: mapToBedrockType(p.type), description: p.variable }; if (p.isRequired) req.push(p.variable); }); return { type: "object", properties: props, required: req.length ? req : undefined }; }
function sanitizeToolName(n: string): string { return n.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64); }

async function recordUsageTransaction(
    userId: string, 
    cost: number, 
    telemetry: {
        sessionId: string,
        sessionTitle?: string,
        actionType: 'LLM_INFERENCE' | 'TOOL_EXECUTION',
        modelId?: string,
        toolName?: string,
        inputTokens?: number,
        outputTokens?: number
    }
) {
    if (cost <= 0) return;

    const recordId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    try {
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE!,
                        Key: { cognitoUserId: userId },
                        UpdateExpression: "SET computeCredits = computeCredits - :cost",
                        ExpressionAttributeValues: { ":cost": cost }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE!, 
                        Item: {
                            id: recordId,
                            userId: userId,
                            sessionId: telemetry.sessionId,
                            sessionTitle: telemetry.sessionTitle || 'Terminal Session',
                            actionType: telemetry.actionType,
                            modelId: telemetry.modelId || 'N/A',
                            toolName: telemetry.toolName || 'N/A',
                            creditsUsed: cost,
                            inputTokens: telemetry.inputTokens || 0,
                            outputTokens: telemetry.outputTokens || 0,
                            createdAt: now
                        }
                    }
                }
            ]
        }));
    } catch (err) {
        console.error(`CRITICAL: Transaction failed for user ${userId}. Credits not deducted.`, err);
    }
}