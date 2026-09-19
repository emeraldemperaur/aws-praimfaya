import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PollyClient } from "@aws-sdk/client-polly";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

import { CORE_SYSTEM_TOOLS, isValidUrl, NATIVE_TOOLS_REGISTRY } from "../chat-handler/tool-registry";
import { TOOL_EXECUTORS } from "../chat-handler/executors";
import { MODEL_CREDIT_MULTIPLIERS } from "../chat-handler/model-credit-multipliers";
import { executeBYOMCP } from "../chat-handler/executors/mcp-tools";

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
const VECTOR_COLLECTIONS_BUCKET = process.env.VECTOR_COLLECTIONS_BUCKET_NAME!;
const TERMINAL_MESSAGES_TABLE = process.env.TERMINAL_MESSAGES_TABLE_NAME!;
const CONSOLE_TERMINAL_TABLE = process.env.CONSOLE_TERMINAL_TABLE_NAME || 'ConsoleTerminal';
const AGENT_ACTIVITY_TABLE = process.env.AGENT_ACTIVITY_TABLE_NAME || 'AgentActivity';

const MAX_CACHE_ENTRIES = 500;
const workflowEmbeddingCache: Record<string, number[]> = {};
const nativeToolEmbeddingCache: Record<string, number[]> = {};

const setBoundedCache = (cache: Record<string, number[]>, key: string, vector: number[]) => {
    const keys = Object.keys(cache);
    if (keys.length >= MAX_CACHE_ENTRIES) {
        delete cache[keys[0]];
    }
    cache[key] = vector;
};

const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { 
    "generate_luma_video": 150000, 
    "generate_audio": 500, 
    "generate_image": 30000, 
    "generate_enterprise_image": 4000, 
    "edit_image": 15000, 
    "enterprise_voice_agent": 2500, 
    "generate_document_agent": 100,
    "jotform_agile_agent": 500,        
    "formstack_agile_agent": 500        
};

const NOCTURNAL_TOOLS = ['schedule_future_task'];

const IMPACTFUL_TOOLS: string[] = [
    
];

const INTERNAL_AWS_TOOLS = [
    'schedule_future_task', 'generate_audio', 'generate_image', 'generate_enterprise_image', 'edit_image',
    'generate_luma_video', 'generate_luma_video_presentation', 'generate_document_agent', 'generate_powerpoint_agent',
    'read_user_attachment', 'enterprise_voice_agent', 'execute_qa_agent_task', 'request_secure_credentials',
    'mito_mcp_agent', 'apotheosis_mcp_agent', 'byo_mcp_agent'
];

const safeJsonParse = (str: any, fallback: any = {}) => {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch { return fallback; }
};

const resolveToolCredentials = (toolName: string, userIntegrations: any, ephemeralSecrets: any) => {
    if (userIntegrations[toolName] && Array.isArray(userIntegrations[toolName]) && userIntegrations[toolName].length > 0) {
        return userIntegrations[toolName].find((c: any) => c.priority) || userIntegrations[toolName][0];
    }
    if (ephemeralSecrets[toolName]) return ephemeralSecrets[toolName];
    if (ephemeralSecrets[`approved_${toolName}`]) return { authorized: true };
    return null;
};

export const handler = async (event: any) => {
    const startTime = Date.now();
    try {
        const { profileId, prompt: userMessage, cognitoUserId, sessionId, terminalId, ephemeralSecretsJson, chatHistory, userProfile } = event;
        const activeSessionId = terminalId || sessionId;

        const terminalRes = await dynamodb.send(new GetCommand({ TableName: CONSOLE_TERMINAL_TABLE, Key: { id: activeSessionId } }));
        const terminal = terminalRes.Item || {};

        if (terminal.status === 'ARCHIVED' || terminal.status === 'HALTED') {
            await logActivity(activeSessionId, cognitoUserId, 'FAILED', 'system_kill_switch', 'Execution aborted: User triggered Kill Switch from UI.', "system", startTime);
            return { error: 'Execution Aborted by Kill Switch' };
        }

        const isDeusExMachina = terminal.deusExMachina === true;
        const ephemeralSecrets = safeJsonParse(ephemeralSecretsJson, {});
        const history = safeJsonParse(chatHistory, []);

        let dbUser = userProfile;
        if (!dbUser) {
            const uRes = await dynamodb.send(new GetCommand({ TableName: USER_PROFILES_TABLE, Key: { cognitoUserId } }));
            dbUser = uRes.Item;
        }

        const computeCredits = dbUser?.computeCredits ?? 0;
        const isNocturnalEnabled = dbUser?.nocturnalAgents === true;
        const userIntegrations = typeof dbUser?.integrations === 'string' ? JSON.parse(dbUser.integrations) : (dbUser?.integrations || {});

        const profileRes = await dynamodb.send(new GetCommand({ TableName: PROFILES_TABLE, Key: { id: profileId } }));
        const profile = profileRes.Item;
        if (!profile) throw new Error("Context Profile not found.");

        const targetModelId = profile.llmModelId || "amazon.nova-pro-v1:0";
        const multiplier = MODEL_CREDIT_MULTIPLIERS[targetModelId] || 2;
        
        const historyString = JSON.stringify(history);
        const systemPromptStr = profile.systemPrompt || "";
        const estimatedInputTokens = Math.ceil((userMessage.length + historyString.length + systemPromptStr.length + 1000) / 4);
        const minimumCreditsNeeded = estimatedInputTokens * multiplier;

        if (computeCredits < minimumCreditsNeeded) {
            await logActivity(activeSessionId, cognitoUserId, 'FAILED', 'billing_enforcer', `Insufficient compute credits. Need ${minimumCreditsNeeded}, have ${computeCredits}.`, targetModelId, startTime, 0, estimatedInputTokens, 0);
            return;
        }

        let agentFinalOutput = "";
        let isGoingToSleep = false;
        const citations: any[] = []; 
        let requestedCredentials: string[] = [];

        const userContentBlocks: any[] = [];
        let cleanPromptText = userMessage;
        const agentFiles: any[] = [];
        
        const contextMatch = userMessage.match(/<vanguard_system_context>([\s\S]*?)<\/vanguard_system_context>/);
        if (contextMatch) {
            const contextContent = contextMatch[1];
            const lines = contextContent.split('\n');
            
            for (const line of lines) {
                if (line.trim().startsWith('- vector-collections/')) {
                    const s3Key = line.trim().substring(2);
                    const ext = s3Key.split('.').pop()?.toLowerCase() || 'txt';
                    
                    try {
                        if (['mp4', 'mov', 'webm'].includes(ext)) {
                            userContentBlocks.push({ video: { format: ext, source: { s3Location: { uri: `s3://${VECTOR_COLLECTIONS_BUCKET}/${s3Key}` } } } });
                        } else if (['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(ext)) {
                            const obj = await s3Client.send(new GetObjectCommand({ Bucket: VECTOR_COLLECTIONS_BUCKET, Key: s3Key }));
                            const bytes = await obj.Body?.transformToByteArray();
                            if (bytes) userContentBlocks.push({ image: { format: ext === 'jpg' ? 'jpeg' : ext, source: { bytes } } });
                        } else {
                            const formatMap: Record<string, string> = { pdf: 'pdf', csv: 'csv', txt: 'txt', md: 'md', html: 'html', doc: 'doc', docx: 'docx', xls: 'xls', xlsx: 'xlsx' };
                            const docFormat = formatMap[ext] || 'txt';
                            const obj = await s3Client.send(new GetObjectCommand({ Bucket: VECTOR_COLLECTIONS_BUCKET, Key: s3Key }));
                            const bytes = await obj.Body?.transformToByteArray();
                            if (bytes) userContentBlocks.push({ document: { name: `file_${Date.now()}`, format: docFormat, source: { bytes } } });
                        }

                        if (!['mp4', 'mov', 'webm'].includes(ext)) {
                             const mimeMap: Record<string, string> = { pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', md: 'text/plain', html: 'text/html', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp' };
                            const obj = await s3Client.send(new GetObjectCommand({ Bucket: VECTOR_COLLECTIONS_BUCKET, Key: s3Key }));
                            const bytes = await obj.Body?.transformToByteArray();
                            if (bytes) agentFiles.push({ name: s3Key.split('/').pop() || `file_${Date.now()}`, source: { sourceType: 'BYTE_CONTENT', byteContent: { mediaType: mimeMap[ext] || 'text/plain', data: bytes } }, useCase: 'CHAT' });
                        }
                    } catch (fetchErr) {
                        console.error(`Failed to process attachment ${s3Key}:`, fetchErr);
                    }
                }
            }
            cleanPromptText = userMessage.replace(/<vanguard_system_context>[\s\S]*?<\/vanguard_system_context>/, '').trim();
        }

        if (cleanPromptText) {
            userContentBlocks.push({ text: cleanPromptText });
        }

        if (profile.role === 'SUPERVISOR' && profile.awsAgentId && profile.awsAliasId) {
            const safeSessionId = cognitoUserId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) + "-session";
            let dynamicPrompt = profile.systemPrompt || "You are an enterprise supervisor agent.";
            
            if (!isNocturnalEnabled) {
                dynamicPrompt += `\n\n[SYSTEM CONSTRAINT]: You do NOT have permission to schedule tasks or run background jobs. If the user requests this, politely decline and inform them they need to enable 'Nocturnal Agents' in their account settings.`;
            }

            await logActivity(activeSessionId, cognitoUserId, 'RUNNING', 'supervisor_delegation', 'Supervisor Agent initialized and streaming response...', targetModelId, startTime, 0, estimatedInputTokens, 0);

            const invokeAgentRes = await bedrockAgentRuntime.send(new InvokeAgentCommand({
                agentId: profile.awsAgentId, agentAliasId: profile.awsAliasId, sessionId: safeSessionId,
                inputText: cleanPromptText || "Analyze attached files.", enableTrace: false,
                sessionState: {
                    sessionAttributes: { userId: cognitoUserId, terminalId: activeSessionId, terminalTitle: profile.title || 'Managed Agent Session', contextProfileName: profile.name || 'Supervisor Agent', contextProfileId: profile.id },
                    promptSessionAttributes: { dynamicSystemPrompt: dynamicPrompt, injectedIntegrations: JSON.stringify(userIntegrations) },
                    ...(agentFiles.length > 0 ? { files: agentFiles } : {})
                }
            }));

            let streamCost = minimumCreditsNeeded;
            for await (const streamEvent of invokeAgentRes.completion || []) {
                if (streamEvent.chunk?.bytes) {
                    agentFinalOutput += new TextDecoder("utf-8").decode(streamEvent.chunk.bytes);
                    const currentOutputTokens = Math.ceil(agentFinalOutput.length / 4);
                    streamCost = (estimatedInputTokens + currentOutputTokens) * multiplier;
                    if (streamCost >= computeCredits) {
                        agentFinalOutput += "\n\n[SYSTEM: EXECUTION HALTED - COMPUTE CREDITS EXHAUSTED. PLEASE TOP UP TO CONTINUE.]";
                        break; 
                    }
                }
            }

            const authRegex = /<vanguard_auth_request>(.*?)<\/vanguard_auth_request>/g;
            let match;
            while ((match = authRegex.exec(agentFinalOutput)) !== null) {
                requestedCredentials.push(match[1].toLowerCase().trim());
            }
            
            agentFinalOutput = agentFinalOutput.replace(authRegex, '').trim();
            const outputTokens = Math.ceil(agentFinalOutput.length / 4);
            const llmCost = Math.ceil((estimatedInputTokens + outputTokens) * multiplier);
            
            if (llmCost > 0) {
                await recordUsageTransaction(cognitoUserId, llmCost, {
                    sessionId: activeSessionId, sessionTitle: profile.title || 'Managed Agent Session', actionType: 'LLM_INFERENCE', 
                    modelId: targetModelId, inputTokens: estimatedInputTokens, outputTokens: outputTokens
                });
            }

            await logActivity(activeSessionId, cognitoUserId, 'COMPLETED', 'supervisor_delegation', 'Supervisor finished processing response.', targetModelId, startTime, llmCost, estimatedInputTokens, outputTokens);
        }
        else {
            let systemPrompt = profile.systemPrompt || "You are a helpful AI assistant.";
            systemPrompt += `\n\n[CRITICAL ROUTING DIRECTIVE]: You act as an intelligent workflow coordinator. Evaluate if an automation workflow (wf_) can fulfill the user's overarching intent first before cascading down to Native Tools. Note that workflow descriptions contain a [Priority: X/10] indicator; if multiple workflows are relevant, heavily favor the one with the highest user-specified priority.`;

            const llmTemperature = profile.temperature !== undefined && profile.temperature !== null ? profile.temperature : 0.7;

            if (profile.vectorCollectionId) {
                try {
                    const retrieveResponse = await bedrockAgentRuntime.send(new RetrieveCommand({
                        knowledgeBaseId: profile.vectorCollectionId, retrievalQuery: { text: cleanPromptText },
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

            const userQueryVector = await getEmbedding(cleanPromptText);
            const assignedWorkflows = await getAssignedWorkflows(profile.id);
            let relevantWorkflows = assignedWorkflows;

            if (assignedWorkflows.length > 0 && userQueryVector.length > 0) {
                const scoredWorkflows = await Promise.all(
                    assignedWorkflows.map(async (wf) => {
                        let v = workflowEmbeddingCache[wf.id];
                        if (!v) { 
                            v = await getEmbedding(`${wf.name}: ${wf.description || ''}`); 
                            if (v.length > 0) setBoundedCache(workflowEmbeddingCache, wf.id, v); 
                        }
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
                    if (!profile.customMcpUrl || profile.customMcpUrl.trim() === '' || !isValidUrl(profile.customMcpUrl)) return false;
                }
                return true;
            });

            let relevantNativeTools = allowedNativeTools;
            if (userQueryVector.length > 0) {
                const scoredNativeTools = await Promise.all(
                    allowedNativeTools.map(async (tool) => {
                        let v = nativeToolEmbeddingCache[tool.toolSpec.name];
                        if (!v) { 
                            v = await getEmbedding(`${tool.toolSpec.name}: ${tool.toolSpec.description}`); 
                            if (v.length > 0) setBoundedCache(nativeToolEmbeddingCache, tool.toolSpec.name, v); 
                        }
                        return { tool, similarity: cosineSimilarity(userQueryVector, v) };
                    })
                );
                scoredNativeTools.sort((a, b) => b.similarity - a.similarity);
                relevantNativeTools = scoredNativeTools.filter(item => item.similarity >= 0.20).slice(0, 6).map(item => item.tool);
            }

            const allTools = [...workflowTools, ...CORE_SYSTEM_TOOLS, ...relevantNativeTools];
            const toolConfig = allTools.length > 0 ? { tools: allTools as any[] } : undefined;
            const messages = [...history, { role: "user", content: userContentBlocks }];

            let totalInboundTokens = 0; 
            let totalOutboundTokens = 0; 
            let flatToolCredits = 0;
            const safeMaxTokens = Math.max(256, Math.min(4096, Math.floor((computeCredits - (estimatedInputTokens * multiplier)) / multiplier)));

            let converseResponse = await bedrockRuntime.send(new ConverseCommand({
                modelId: targetModelId, messages: messages, system: [{ text: systemPrompt }], 
                toolConfig: toolConfig, inferenceConfig: { temperature: llmTemperature, maxTokens: safeMaxTokens }
            }));

            totalInboundTokens += converseResponse.usage?.inputTokens || 0;
            totalOutboundTokens += converseResponse.usage?.outputTokens || 0;

            let loopCount = 0;
            const MAX_TOOL_LOOPS = 5;

            while (loopCount < MAX_TOOL_LOOPS) {
                const outputMessage = converseResponse.output?.message;
                const toolUseBlocks = outputMessage?.content?.filter(block => block.toolUse) || [];

                if (toolUseBlocks.length === 0) {
                    agentFinalOutput = outputMessage?.content?.[0]?.text || "Task complete.";
                    break;
                }

                messages.push(outputMessage!);
                const toolResults = [];

                for (const block of toolUseBlocks) {
                    const toolUse = block.toolUse!;
                    if (!toolUse.name || !toolUse.toolUseId) continue;
                    
                    const toolInput: any = toolUse.input || {};
                    let executionResult: any;

                    if (MULTIMODAL_TOOL_FLAT_COSTS[toolUse.name]) {
                        flatToolCredits += MULTIMODAL_TOOL_FLAT_COSTS[toolUse.name];
                    }

                    const isWorkflow = toolUse.name.startsWith('wf_');
                    const toolRequiresAuth = !isWorkflow && !INTERNAL_AWS_TOOLS.includes(toolUse.name);
                    const credentials = resolveToolCredentials(toolUse.name, userIntegrations, ephemeralSecrets);

                    const isImpactful = IMPACTFUL_TOOLS.includes(toolUse.name);

                    if (isDeusExMachina && isImpactful && !ephemeralSecrets[`approved_${toolUse.name}`]) {
                        const payloadPreview = JSON.stringify(toolInput);
                        
                        agentFinalOutput = `<vanguard_auth_request>approved_${toolUse.name}</vanguard_auth_request>\n[HITL INTERVENTION REQUIRED]: Human authorization is strictly required to execute tool: **${toolUse.name}**.\n\nProposed Action Payload:\n\`\`\`json\n${payloadPreview}\n\`\`\`\n\nPlease review the payload and approve to proceed.`;
                        
                        await logActivity(activeSessionId, cognitoUserId, 'BLOCKED', toolUse.name, `Awaiting Human-in-the-Loop (HITL) approval. Proposed payload: ${payloadPreview.substring(0, 100)}...`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                        isGoingToSleep = true;
                        break; 
                    }

                    if (toolRequiresAuth && !credentials) {
                        agentFinalOutput = `<vanguard_auth_request>${toolUse.name}</vanguard_auth_request>\nPlease provide credentials to proceed.`;
                        await logActivity(activeSessionId, cognitoUserId, 'BLOCKED', toolUse.name, `Awaiting external API credentials to execute [${toolUse.name}].`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                        isGoingToSleep = true;
                        break; 
                    }

                    if (NOCTURNAL_TOOLS.includes(toolUse.name) && !isNocturnalEnabled) {
                        executionResult = { error: "Permission Denied: UserProfile.nocturnalAgents is disabled. You cannot schedule tasks." };
                    }
                    else if (toolUse.name === 'request_secure_credentials') {
                        requestedCredentials.push(toolInput.serviceName?.toLowerCase());
                        executionResult = { status: "Success. The frontend is displaying a secure credential prompt. Tell the user you are waiting for them." };
                    }
                    else if (TOOL_EXECUTORS[toolUse.name]) {
                        try {
                            await logActivity(activeSessionId, cognitoUserId, 'RUNNING', toolUse.name, `Executing tool [${toolUse.name}] parameters: ${JSON.stringify(toolInput).substring(0, 100)}...`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                            
                            const context = {
                                toolInput, credentials, ephemeralSecrets, profile, userProfile: dbUser,
                                cognitoUserId, sessionId: activeSessionId, citations,
                                clients: { s3: s3Client, polly: pollyClient, bedrockRuntime: bedrockRuntime, dynamodb: dynamodb, lambda: lambdaClient },
                                env: process.env as Record<string, string>
                            };
                            
                            executionResult = await TOOL_EXECUTORS[toolUse.name](context);
                            if (executionResult?.additionalCreditsUsed) flatToolCredits += executionResult.additionalCreditsUsed;
                            
                            await logActivity(activeSessionId, cognitoUserId, 'COMPLETED', toolUse.name, `Successfully executed [${toolUse.name}].`, targetModelId, startTime, executionResult?.additionalCreditsUsed || 0, totalInboundTokens, totalOutboundTokens);

                            if (executionResult && executionResult.__END_CURRENT_EXECUTION__) {
                                isGoingToSleep = true;
                                await dynamodb.send(new PutCommand({
                                    TableName: TERMINAL_MESSAGES_TABLE,
                                    Item: { id: `msg_sleep_${Date.now()}`, terminalId: activeSessionId, role: 'SYSTEM', content: `[SYSTEM: ${executionResult.message}]`, createdAt: new Date().toISOString() }
                                }));
                                break; 
                            }
                        } catch (err: any) {
                            executionResult = { error: `Tool Execution Error: ${err.message}` };
                            await logActivity(activeSessionId, cognitoUserId, 'FAILED', toolUse.name, `Tool execution failed: ${err.message}`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                        }
                    } 
                    else if (isWorkflow) {
                        const matchedWf = assignedWorkflows.find(wf => sanitizeToolName(`wf_${wf.id}`) === toolUse.name);
                        await logActivity(activeSessionId, cognitoUserId, 'RUNNING', toolUse.name, `Routing to Workflow Engine: ${matchedWf?.name || 'Unknown'}`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                        executionResult = matchedWf ? await invokeWebhookRouter(matchedWf.id, toolInput) : { error: "Workflow not found." };
                        await logActivity(activeSessionId, cognitoUserId, 'COMPLETED', toolUse.name, `Workflow execution complete.`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                    } 
                    else if (profile.customMcpUrl) {
                        await logActivity(activeSessionId, cognitoUserId, 'RUNNING', toolUse.name, `Calling Custom MCP Server...`, targetModelId, startTime, 0, totalInboundTokens, totalOutboundTokens);
                        executionResult = await executeMcpTool(profile.customMcpUrl, toolUse.name, toolInput);
                    }

                    toolResults.push({ toolResult: { toolUseId: toolUse.toolUseId, content: [{ text: JSON.stringify(executionResult) }], status: executionResult?.error ? "error" : "success" } });
                }

                if (agentFinalOutput || isGoingToSleep) break;

                messages.push({ role: "user", content: toolResults });
                
                converseResponse = await bedrockRuntime.send(new ConverseCommand({ 
                    modelId: targetModelId, messages: messages, system: [{ text: systemPrompt }],
                    toolConfig: toolConfig, inferenceConfig: { temperature: llmTemperature, maxTokens: safeMaxTokens }
                }));

                totalInboundTokens += converseResponse.usage?.inputTokens || 0;
                totalOutboundTokens += converseResponse.usage?.outputTokens || 0;
                loopCount++;
            }

            const totalDeduction = Math.ceil((totalInboundTokens + totalOutboundTokens) * multiplier) + flatToolCredits;

            if (totalDeduction > 0) {
                await recordUsageTransaction(cognitoUserId, totalDeduction, {
                    sessionId: activeSessionId, sessionTitle: profile.title, actionType: 'LLM_INFERENCE', 
                    modelId: targetModelId, inputTokens: totalInboundTokens, outputTokens: totalOutboundTokens
                });
            }
        }

        if (isGoingToSleep) return; 

        if (agentFinalOutput) {
            await dynamodb.send(new PutCommand({
                TableName: TERMINAL_MESSAGES_TABLE,
                Item: {
                    id: `msg_ai_${Date.now()}`, terminalId: activeSessionId, role: 'ASSISTANT',
                    content: agentFinalOutput, contextSources: citations.map(c => c.uri || c.type),
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                }
            }));
        }

    } catch (error: any) {
        console.error("Worker Execution Error:", error);
        await dynamodb.send(new PutCommand({
            TableName: process.env.TERMINAL_MESSAGES_TABLE_NAME!,
            Item: { id: `msg_err_${Date.now()}`, terminalId: event.terminalId || event.sessionId || `session-${Date.now()}`, role: 'ASSISTANT', content: `[SYSTEM FAILURE]: ${error.message}`, createdAt: new Date().toISOString() }
        }));
    }
};


async function logActivity(
    terminalId: string, userId: string, lifecycleState: string, toolName: string, 
    thoughtLog: string, modelId: string, startTime: number, computeCredits: number = 0,
    inputTokens: number = 0, outputTokens: number = 0
) {
    const durationMs = Date.now() - startTime;
    try {
        await dynamodb.send(new PutCommand({
            TableName: AGENT_ACTIVITY_TABLE,
            Item: {
                id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, terminalId, userId, lifecycleState, toolName, thoughtLog, modelId, computeCredits, inputTokens, outputTokens, durationMs, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            }
        }));
    } catch (err) {
        console.error("Failed to write to AgentActivity table", err);
    }
}

async function getEmbedding(text: string): Promise<number[]> { 
    try { 
        const res = await bedrockRuntime.send(new InvokeModelCommand({ modelId: "amazon.titan-embed-text-v2:0", contentType: "application/json", accept: "application/json", body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }) })); 
        return JSON.parse(new TextDecoder().decode(res.body)).embedding || []; 
    } catch { return []; } 
}

function cosineSimilarity(a: number[], b: number[]): number { 
    if (!a.length || !b.length || a.length !== b.length) return 0; 
    let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; 
}

async function invokeWebhookRouter(id: string, payload: any) { 
    try { 
        const res = await lambdaClient.send(new InvokeCommand({ FunctionName: WEBHOOK_ROUTER_ARN, Payload: Buffer.from(JSON.stringify({ parameters: [{ name: 'workflowId', value: id }, { name: 'payloadJson', value: JSON.stringify(payload) }] })) })); 
        const out = JSON.parse(Buffer.from(res.Payload!).toString()); 
        return out?.response?.functionResponse?.responseBody?.TEXT?.body ? JSON.parse(out.response.functionResponse.responseBody.TEXT.body) : out; 
    } catch (err: any) { return { error: err.message }; } 
}

async function getAssignedWorkflows(pid: string) { 
    const m = await dynamodb.send(new QueryCommand({ TableName: PROFILE_WORKFLOWS_TABLE, IndexName: 'byProfile', KeyConditionExpression: 'contextProfileId = :pid', ExpressionAttributeValues: { ':pid': pid } })); 
    const wfs = []; 
    for (const wId of (m.Items?.map(i => i.contextWorkflowId) || [])) { 
        const r = await dynamodb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { id: wId } })); 
        if (r.Item && !r.Item.archived) wfs.push(r.Item); 
    } 
    return wfs; 
}

async function executeMcpTool(url: string, name: string, args: any) {
    const mockContext: any = { toolInput: { action: 'CALL_TOOL', mcpToolName: name, mcpArguments: args }, profile: { customMcpUrl: url } };
    return await executeBYOMCP(mockContext);
}

function mapToBedrockType(t?: string): string { 
    switch (t?.toLowerCase()) { case 'number': case 'float': return 'number'; case 'boolean': return 'boolean'; case 'array': return 'array'; case 'object': return 'object'; default: return 'string'; } 
}

function buildJsonSchemaFromParams(params?: any[]) { 
    if (!params || !params.length) return { type: "object", properties: {} }; 
    const props: any = {}; const req: string[] = []; 
    params.forEach(p => { props[p.variable] = { type: mapToBedrockType(p.type), description: p.variable }; if (p.isRequired) req.push(p.variable); }); 
    return { type: "object", properties: props, required: req.length ? req : undefined }; 
}

function sanitizeToolName(n: string): string { return n.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64); }

async function recordUsageTransaction(
    userId: string, cost: number, telemetry: { sessionId: string, sessionTitle?: string, actionType: 'LLM_INFERENCE' | 'TOOL_EXECUTION', modelId?: string, toolName?: string, inputTokens?: number, outputTokens?: number }
) {
    if (cost <= 0) return;
    const recordId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    try {
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                { Update: { TableName: USER_PROFILES_TABLE!, Key: { cognitoUserId: userId }, UpdateExpression: "SET computeCredits = computeCredits - :cost", ExpressionAttributeValues: { ":cost": cost } } },
                { Put: { TableName: USAGE_RECORDS_TABLE!, Item: { id: recordId, userId: userId, sessionId: telemetry.sessionId, sessionTitle: telemetry.sessionTitle || 'Terminal Session', actionType: telemetry.actionType, modelId: telemetry.modelId || 'N/A', toolName: telemetry.toolName || 'N/A', creditsUsed: cost, inputTokens: telemetry.inputTokens || 0, outputTokens: telemetry.outputTokens || 0, createdAt: now } } }
            ]
        }));
    } catch (err) {
        console.error(`CRITICAL: Transaction failed for user ${userId}. Attempting direct credit deduction fallback.`, err);
        try { await dynamodb.send(new UpdateCommand({ TableName: USER_PROFILES_TABLE!, Key: { cognitoUserId: userId }, UpdateExpression: "SET computeCredits = computeCredits - :cost", ExpressionAttributeValues: { ":cost": cost } })); } catch (fallbackErr) { console.error(`FATAL: Fallback credit deduction failed for user ${userId}:`, fallbackErr); }
    }
}