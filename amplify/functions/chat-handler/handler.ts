import { BedrockRuntimeClient, ConverseCommand, StartAsyncInvokeCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, RetrieveCommand, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import * as jwt from "jsonwebtoken";
import * as xlsx from "xlsx";
import { CORE_SYSTEM_TOOLS, isValidUrl, NATIVE_TOOLS_REGISTRY } from "./tool-registry"; // Assuming you moved the registry to a separate file

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
const MEDIA_OUTPUT_BUCKET = process.env.MEDIA_OUTPUT_BUCKET_NAME || "praimfaya-media-outputs";
const PYTHON_VALIDATOR_LAMBDA_ARN = process.env.PYTHON_VALIDATOR_LAMBDA_ARN!;

const workflowEmbeddingCache: Record<string, number[]> = {};
const nativeToolEmbeddingCache: Record<string, number[]> = {};

const MODEL_CREDIT_MULTIPLIERS: Record<string, number> = { "amazon.nova-micro-v1:0": 1, "anthropic.claude-3-5-sonnet-20241022-v2:0": 15 };
const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { "generate_luma_video": 150000, "generate_audio": 500, "generate_image": 25000, "generate_enterprise_image": 20000, "edit_image": 25000 };

const mcpToolCache: Record<string, { tools: any[]; expiresAt: number }> = {};
const MCP_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes in milliseconds

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

        const citations: any[] = []; 
        let requestedCredentials: string[] = [];

        // ==========================================
        // TRAFFIC COP: ROUTE TO MANAGED AGENT (SUPERVISOR)
        // ==========================================
        if (profile.role === 'SUPERVISOR' && profile.awsAgentId && profile.awsAliasId) {
            try {
                // Generate a valid Bedrock session ID (alphanumeric, max 100 chars)
                const safeSessionId = cognitoUserId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50) + "-session";
                
                const invokeAgentRes = await bedrockAgentRuntime.send(new InvokeAgentCommand({
                    agentId: profile.awsAgentId,
                    agentAliasId: profile.awsAliasId,
                    sessionId: safeSessionId,
                    inputText: userMessage,
                    enableTrace: false
                }));

                let agentResponse = "";
                for await (const chunk of invokeAgentRes.completion || []) {
                    if (chunk.chunk?.bytes) {
                        agentResponse += new TextDecoder("utf-8").decode(chunk.chunk.bytes);
                    }
                }

                return JSON.stringify({ 
                    answer: agentResponse, 
                    citations: [], 
                    requestedCredentials: [], 
                    tokenUsage: { inputTokens: 0, outputTokens: 0 } 
                });

            } catch (err: any) {
                return JSON.stringify({ error: `Managed Agent Execution Failed: ${err.message}` });
            }
        }

        // ==========================================
        // TRAFFIC COP: ROUTE TO STANDARD AGENT
        // ==========================================
        let systemPrompt = profile.systemPrompt || "You are a helpful AI assistant.";
        systemPrompt += `\n\n[CRITICAL ROUTING DIRECTIVE]: You act as an intelligent workflow coordinator. Evaluate if an automation workflow (wf_) can fulfill the user's overarching intent first before cascading down to Native Tools.`;

        const targetModelId = profile.llmModelId || "global.amazon.nova-micro-v1:0";

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
            if (tool.toolSpec.name === 'custom_mcp_agent') {
                if (!profile.customMcpUrl || profile.customMcpUrl.trim() === '' || !isValidUrl(profile.customMcpUrl)) { return false;}}
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

        //let mcpTools: any[] = [];
        //if (profile.role === 'STANDARD' && profile.customMcpUrl) mcpTools = await fetchMcpToolsWithCache(profile.customMcpUrl);

        const allTools = [...workflowTools, ...CORE_SYSTEM_TOOLS, ...relevantNativeTools];
        const toolConfig = allTools.length > 0 ? { tools: allTools as any[] } : undefined;
        const messages = [...history, { role: "user", content: [{ text: userMessage }] }];

        let totalInboundTokens = 0; let totalOutboundTokens = 0; let flatToolCredits = 0;

        let converseResponse = await bedrockRuntime.send(new ConverseCommand({
            modelId: targetModelId, messages: messages, system: [{ text: systemPrompt }], toolConfig: toolConfig
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
                
                

                // =========================================
                // MEDIA TOOLS 
                // =========================================
                else if (toolUse.name === 'generate_audio') {
                    try {
                        const pollyRes = await pollyClient.send(new SynthesizeSpeechCommand({ Engine: "generative", OutputFormat: "mp3", Text: toolInput.text, VoiceId: toolInput.voiceId || "Matthew" }));
                        const audioBytes = await pollyRes.AudioStream?.transformToByteArray();
                        if (audioBytes) {
                            const fileName = `audio-renders/${Date.now()}.mp3`;
                            await s3Client.send(new PutObjectCommand({ Bucket: MEDIA_OUTPUT_BUCKET, Key: fileName, Body: Buffer.from(audioBytes), ContentType: "audio/mpeg" }));
                            const audioUrl = `https://${MEDIA_OUTPUT_BUCKET}.s3.amazonaws.com/${fileName}`;
                            citations.push({ type: 'asset', uri: audioUrl });
                            executionResult = { status: "Success", audioUrl };
                        }
                    } catch (err: any) { executionResult = { error: err.message }; }
                } 
                else if (toolUse.name === 'generate_image' || toolUse.name === 'generate_enterprise_image' || toolUse.name === 'edit_image') {
                    try {
                        const modelId = toolUse.name === 'generate_image' ? "stability.sd3-5-large-v1:0" : (toolUse.name === 'edit_image' ? "amazon.nova-canvas-v1:0" : "amazon.titan-image-generator-v2:0");
                        const reqBody = toolUse.name === 'generate_image' ? { prompt: toolInput.prompt, output_format: "jpeg" } : { taskType: "TEXT_IMAGE", textToImageParams: { text: toolInput.prompt }, imageGenerationConfig: { numberOfImages: 1, height: 1024, width: 1024 } };
                        const invokeRes = await bedrockRuntime.send(new InvokeModelCommand({ modelId, contentType: "application/json", accept: "application/json", body: JSON.stringify(reqBody) }));
                        executionResult = await processAndUploadImageOutput(invokeRes.body, toolUse.name);
                        if (executionResult.imageUrl) citations.push({ type: 'media', uri: executionResult.imageUrl });
                    } catch (err: any) { executionResult = { error: err.message }; }
                }

                // =========================================
                // HR & OPERATIONS COMMAND CENTER
                // =========================================
                else if (toolUse.name === 'rippling_hr_agent') {
                    const RIPPLING_API_KEY = ephemeralSecrets.ripplingApiKey;
                    if (!RIPPLING_API_KEY) {
                        executionResult = { error: "Missing Rippling API Key. You MUST call 'request_secure_credentials' with serviceName 'rippling' to proceed." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${RIPPLING_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' };
                            const { action, employeeId, employeeData } = toolInput;
                            if (action === 'ONBOARD_EMPLOYEE') {
                                const res = await axios.post(`https://api.rippling.com/platform/api/employees`, JSON.parse(employeeData || '{}'), { headers });
                                executionResult = { status: "Success", data: res.data };
                            } else if (action === 'GET_EMPLOYEE' && employeeId) {
                                const res = await axios.get(`https://api.rippling.com/platform/api/employees/${employeeId}`, { headers });
                                executionResult = { status: "Success", data: res.data };
                            } else {
                                executionResult = { error: `Unsupported or malformed Rippling action parameters: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Rippling Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'bamboohr_agent') {
                    const BAMBOO_API_KEY = ephemeralSecrets.bambooApiKey;
                    const BAMBOO_SUBDOMAIN = ephemeralSecrets.bambooSubdomain;
                    if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
                        executionResult = { error: "Missing BambooHR credentials. You MUST call 'request_secure_credentials' with serviceName 'bamboohr'." };
                    } else {
                        try {
                            const authHeader = `Basic ${Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64')}`;
                            const headers = { Authorization: authHeader, Accept: 'application/json' };
                            const { action } = toolInput;
                            if (action === 'GET_DIRECTORY') {
                                const res = await axios.get(`https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1/employees/directory`, { headers });
                                executionResult = { status: "Success", directory: res.data.employees?.slice(0, 50) };
                            } else if (action === 'GET_TIME_OFF') {
                                const start = new Date().toISOString().split('T')[0];
                                const res = await axios.get(`https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1/time_off/requests?start=${start}`, { headers });
                                executionResult = { status: "Success", requests: res.data };
                            }
                        } catch (err: any) { executionResult = { error: `BambooHR Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'zendesk_support_agent') {
                    const ZENDESK_TOKEN = ephemeralSecrets.zendeskToken;
                    const ZENDESK_EMAIL = ephemeralSecrets.zendeskEmail;
                    const ZENDESK_SUBDOMAIN = ephemeralSecrets.zendeskSubdomain;
                    if (!ZENDESK_TOKEN || !ZENDESK_EMAIL || !ZENDESK_SUBDOMAIN) {
                        executionResult = { error: "Missing Zendesk credentials. You MUST call 'request_secure_credentials' with serviceName 'zendesk'." };
                    } else {
                        try {
                            const authString = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64');
                            const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json' };
                            const { action, ticketId, query, ticketData } = toolInput; 
                            if (action === 'TRIAGE_TICKETS' || action === 'SEARCH_KB') {
                                const endpoint = action === 'TRIAGE_TICKETS' ? 'search.json' : 'help_center/articles/search.json';
                                const res = await axios.get(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/${endpoint}?query=${encodeURIComponent(query || 'type:ticket status:open')}`, { headers });
                                executionResult = { status: "Success", results: res.data.results?.slice(0, 10) };
                            } else if (action === 'UPDATE_TICKET' && ticketId) {
                                const res = await axios.put(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`, JSON.parse(ticketData || '{}'), { headers: { ...headers, 'Content-Type': 'application/json' } });
                                executionResult = { status: "Success", ticket: res.data.ticket };
                            }
                        } catch (err: any) { executionResult = { error: `Zendesk Error: ${err.response?.data?.error || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'servicenow_itsm_agent') {
                    const SNOW_USER = ephemeralSecrets.serviceNowUser;
                    const SNOW_PASS = ephemeralSecrets.serviceNowPassword;
                    const SNOW_INSTANCE = ephemeralSecrets.serviceNowInstance;
                    if (!SNOW_USER || !SNOW_PASS || !SNOW_INSTANCE) {
                        executionResult = { error: "Missing ServiceNow credentials. You MUST call 'request_secure_credentials' with serviceName 'servicenow'." };
                    } else {
                        try {
                            const authString = Buffer.from(`${SNOW_USER}:${SNOW_PASS}`).toString('base64');
                            const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json' };
                            const { action, sysId, resolutionNotes } = toolInput;
                            if (action === 'GET_INCIDENT' && sysId) {
                                const res = await axios.get(`https://${SNOW_INSTANCE}.service-now.com/api/now/table/incident/${sysId}`, { headers });
                                executionResult = { status: "Success", incident: res.data.result };
                            } else if (action === 'RESOLVE_INCIDENT' && sysId) {
                                const payload = { state: '6', close_notes: resolutionNotes }; 
                                const res = await axios.put(`https://${SNOW_INSTANCE}.service-now.com/api/now/table/incident/${sysId}`, payload, { headers: { ...headers, 'Content-Type': 'application/json' } });
                                executionResult = { status: "Success", incident: res.data.result };
                            }
                        } catch (err: any) { executionResult = { error: `ServiceNow Error: ${err.response?.data?.error?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'pagerduty_sre_agent') {
                    const PD_API_KEY = ephemeralSecrets.pagerDutyApiKey;
                    const PD_USER_EMAIL = ephemeralSecrets.pagerDutyUserEmail; 
                    if (!PD_API_KEY) {
                        executionResult = { error: "Missing PagerDuty credentials. You MUST call 'request_secure_credentials' with serviceName 'pagerduty'." };
                    } else {
                        try {
                            const headers: any = { Authorization: `Token token=${PD_API_KEY}`, Accept: 'application/vnd.pagerduty+json;version=2', 'Content-Type': 'application/json' };
                            if (PD_USER_EMAIL) headers['From'] = PD_USER_EMAIL;
                            const { action, incidentId } = toolInput;
                            if (action === 'LIST_ALERTS' || action === 'RUN_DIAGNOSTICS') {
                                const res = await axios.get(`https://api.pagerduty.com/incidents?statuses[]=triggered&statuses[]=acknowledged`, { headers });
                                executionResult = { status: "Success", incidents: res.data.incidents };
                            } else if ((action === 'ACKNOWLEDGE_INCIDENT' || action === 'RESOLVE_INCIDENT') && incidentId) {
                                if (!PD_USER_EMAIL) throw new Error("PagerDuty requires a valid 'From' email header to update incidents. Have the user supply 'pagerDutyUserEmail'.");
                                const status = action === 'ACKNOWLEDGE_INCIDENT' ? 'acknowledged' : 'resolved';
                                const res = await axios.put(`https://api.pagerduty.com/incidents/${incidentId}`, { incident: { type: "incident_reference", status: status } }, { headers });
                                executionResult = { status: "Success", incident: res.data.incident };
                            }
                        } catch (err: any) { executionResult = { error: `PagerDuty Error: ${err.response?.data?.error?.message || err.message}` }; }
                    }
                }

                // =========================================
                // ENTERPRISE PRODUCTIVITY & AGILE OPERATIONS
                // =========================================
                else if (toolUse.name === 'jira_agile_agent' || toolUse.name === 'confluence_wiki_agent') {
                    const ATLASSIAN_EMAIL = ephemeralSecrets.atlassianEmail;
                    const ATLASSIAN_TOKEN = ephemeralSecrets.atlassianToken;
                    const ATLASSIAN_DOMAIN = ephemeralSecrets.atlassianDomain; 
                    
                    if (!ATLASSIAN_EMAIL || !ATLASSIAN_TOKEN || !ATLASSIAN_DOMAIN) {
                        executionResult = { error: `Missing Atlassian credentials. Call 'request_secure_credentials' with serviceName 'atlassian'.` };
                    } else {
                        try {
                            const authString = Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_TOKEN}`).toString('base64');
                            const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json', 'Content-Type': 'application/json' };
                            const { action } = toolInput;
                            const baseUrl = `https://${ATLASSIAN_DOMAIN}.atlassian.net`;

                            if (toolUse.name === 'jira_agile_agent') {
                                if (action === 'SEARCH_ISSUES') {
                                    const res = await axios.get(`${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(toolInput.jqlQuery || '')}&maxResults=15`, { headers });
                                    executionResult = { status: "Success", issues: res.data.issues };
                                } else if (action === 'CREATE_ISSUE') {
                                    const res = await axios.post(`${baseUrl}/rest/api/3/issue`, JSON.parse(toolInput.issueData || '{}'), { headers });
                                    executionResult = { status: "Success", issue: res.data };
                                } else if (action === 'GET_ISSUE') {
                                    const res = await axios.get(`${baseUrl}/rest/api/3/issue/${toolInput.issueKey}`, { headers });
                                    executionResult = { status: "Success", issue: res.data };
                                } else if (action === 'UPDATE_ISSUE') {
                                    const res = await axios.put(`${baseUrl}/rest/api/3/issue/${toolInput.issueKey}`, JSON.parse(toolInput.issueData || '{}'), { headers });
                                    executionResult = { status: "Success" };
                                }
                            } else {
                                // Confluence
                                if (action === 'SEARCH_PAGES') {
                                    const res = await axios.get(`${baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(toolInput.cqlQuery || '')}&limit=10`, { headers });
                                    executionResult = { status: "Success", pages: res.data.results };
                                } else if (action === 'GET_PAGE') {
                                    const res = await axios.get(`${baseUrl}/wiki/rest/api/content/${toolInput.pageId}?expand=body.storage`, { headers });
                                    executionResult = { status: "Success", page: res.data };
                                } else if (action === 'CREATE_PAGE' || action === 'UPDATE_PAGE') {
                                    const res = action === 'CREATE_PAGE' 
                                        ? await axios.post(`${baseUrl}/wiki/rest/api/content`, JSON.parse(toolInput.pageData || '{}'), { headers })
                                        : await axios.put(`${baseUrl}/wiki/rest/api/content/${toolInput.pageId}`, JSON.parse(toolInput.pageData || '{}'), { headers });
                                    executionResult = { status: "Success", page: res.data };
                                }
                            }
                        } catch (err: any) { executionResult = { error: `Atlassian Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'asana_pm_agent') {
                    const ASANA_TOKEN = ephemeralSecrets.asanaToken;
                    if (!ASANA_TOKEN) {
                        executionResult = { error: "Missing Asana credentials. Call 'request_secure_credentials' with serviceName 'asana'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${ASANA_TOKEN}`, Accept: 'application/json' };
                            const { action, workspaceId, taskId, taskData } = toolInput;
                            
                            if (action === 'SEARCH_TASKS' && workspaceId) {
                                const res = await axios.get(`https://app.asana.com/api/1.0/tasks?workspace=${workspaceId}&limit=20`, { headers });
                                executionResult = { status: "Success", tasks: res.data.data };
                            } else if (action === 'GET_TASK' && taskId) {
                                const res = await axios.get(`https://app.asana.com/api/1.0/tasks/${taskId}`, { headers });
                                executionResult = { status: "Success", task: res.data.data };
                            } else if (action === 'CREATE_TASK' || action === 'UPDATE_TASK') {
                                const res = action === 'CREATE_TASK'
                                    ? await axios.post(`https://app.asana.com/api/1.0/tasks`, { data: JSON.parse(taskData || '{}') }, { headers })
                                    : await axios.put(`https://app.asana.com/api/1.0/tasks/${taskId}`, { data: JSON.parse(taskData || '{}') }, { headers });
                                executionResult = { status: "Success", task: res.data.data };
                            }
                        } catch (err: any) { executionResult = { error: `Asana Error: ${err.response?.data?.errors?.[0]?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'notion_workspace_agent') {
                    const NOTION_TOKEN = ephemeralSecrets.notionToken;
                    if (!NOTION_TOKEN) {
                        executionResult = { error: "Missing Notion credentials. Call 'request_secure_credentials' with serviceName 'notion'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
                            const { action, query, pageId, pageData } = toolInput;
                            
                            if (action === 'SEARCH_PAGES') {
                                const res = await axios.post(`https://api.notion.com/v1/search`, { query, page_size: 10 }, { headers });
                                executionResult = { status: "Success", results: res.data.results };
                            } else if (action === 'GET_PAGE') {
                                const res = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, { headers });
                                executionResult = { status: "Success", page: res.data };
                            } else if (action === 'CREATE_PAGE' || action === 'UPDATE_PAGE') {
                                const res = action === 'CREATE_PAGE'
                                    ? await axios.post(`https://api.notion.com/v1/pages`, JSON.parse(pageData || '{}'), { headers })
                                    : await axios.patch(`https://api.notion.com/v1/pages/${pageId}`, JSON.parse(pageData || '{}'), { headers });
                                executionResult = { status: "Success", page: res.data };
                            }
                        } catch (err: any) { executionResult = { error: `Notion Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'contentful_cms_agent') {
                    const CF_TOKEN = ephemeralSecrets.contentfulToken;
                    const CF_SPACE = ephemeralSecrets.contentfulSpaceId;
                    const CF_ENV = ephemeralSecrets.contentfulEnvironment || 'master';
                    if (!CF_TOKEN || !CF_SPACE) {
                        executionResult = { error: "Missing Contentful credentials. Call 'request_secure_credentials' with serviceName 'contentful'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, contentType, entryId, entryData } = toolInput;
                            const baseUrl = `https://api.contentful.com/spaces/${CF_SPACE}/environments/${CF_ENV}/entries`;

                            if (action === 'GET_ENTRIES') {
                                const res = await axios.get(`${baseUrl}?content_type=${contentType || ''}&limit=10`, { headers });
                                executionResult = { status: "Success", entries: res.data.items };
                            } else if (action === 'GET_ENTRY' && entryId) {
                                const res = await axios.get(`${baseUrl}/${entryId}`, { headers });
                                executionResult = { status: "Success", entry: res.data };
                            } else if (action === 'CREATE_ENTRY' || action === 'UPDATE_ENTRY') {
                                const putHeaders = { ...headers, 'X-Contentful-Content-Type': contentType };
                                const res = action === 'CREATE_ENTRY'
                                    ? await axios.post(baseUrl, JSON.parse(entryData || '{}'), { headers: putHeaders })
                                    : await axios.put(`${baseUrl}/${entryId}`, JSON.parse(entryData || '{}'), { headers: putHeaders });
                                executionResult = { status: "Success", entry: res.data };
                            }
                        } catch (err: any) { executionResult = { error: `Contentful Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'sanity_cms_agent') {
                    const SANITY_TOKEN = ephemeralSecrets.sanityToken;
                    const SANITY_PROJECT = ephemeralSecrets.sanityProjectId;
                    const SANITY_DATASET = ephemeralSecrets.sanityDataset || 'production';
                    if (!SANITY_TOKEN || !SANITY_PROJECT) {
                        executionResult = { error: "Missing Sanity credentials. Call 'request_secure_credentials' with serviceName 'sanity'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${SANITY_TOKEN}`, 'Content-Type': 'application/json' };
                            if (toolInput.action === 'QUERY_DOCUMENTS') {
                                const res = await axios.get(`https://${SANITY_PROJECT}.api.sanity.io/v2022-03-07/data/query/${SANITY_DATASET}?query=${encodeURIComponent(toolInput.groqQuery || '')}`, { headers });
                                executionResult = { status: "Success", results: res.data.result };
                            } else if (toolInput.action === 'MUTATE_DOCUMENT') {
                                const res = await axios.post(`https://${SANITY_PROJECT}.api.sanity.io/v2022-03-07/data/mutate/${SANITY_DATASET}`, { mutations: JSON.parse(toolInput.mutations || '[]') }, { headers });
                                executionResult = { status: "Success", results: res.data };
                            }
                        } catch (err: any) { executionResult = { error: `Sanity Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'google_workspace_agent') {
                    const GOOGLE_TOKEN = ephemeralSecrets.googleAccessToken;
                    if (!GOOGLE_TOKEN) {
                        executionResult = { error: "Missing Google OAuth Token. Call 'request_secure_credentials' with serviceName 'google'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${GOOGLE_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, query, documentId, payload } = toolInput;
                            
                            if (action === 'READ_GMAIL') {
                                const res = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query || '')}&maxResults=5`, { headers });
                                executionResult = { status: "Success", messages: res.data.messages };
                            } else if (action === 'SEND_GMAIL') {
                                const res = await axios.post(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, JSON.parse(payload || '{}'), { headers });
                                executionResult = { status: "Success", sent: res.data };
                            } else if (action === 'READ_DOC') {
                                const res = await axios.get(`https://docs.googleapis.com/v1/documents/${documentId}`, { headers });
                                executionResult = { status: "Success", document: res.data.body };
                            } else if (action === 'READ_SHEET') {
                                const res = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${documentId}?includeGridData=true`, { headers });
                                executionResult = { status: "Success", sheets: res.data.sheets };
                            }
                        } catch (err: any) { executionResult = { error: `Google Workspace Error: ${err.response?.data?.error?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'slack_collaboration_agent') {
                    const SLACK_TOKEN = ephemeralSecrets.slackToken;
                    if (!SLACK_TOKEN) {
                        executionResult = { error: "Missing Slack credentials. Call 'request_secure_credentials' with serviceName 'slack'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, channelId, message } = toolInput;
                            
                            if (action === 'READ_CHANNEL_HISTORY') {
                                const res = await axios.get(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, { headers });
                                executionResult = { status: "Success", messages: res.data.messages };
                            } else if (action === 'POST_MESSAGE') {
                                const res = await axios.post(`https://slack.com/api/chat.postMessage`, { channel: channelId, text: message }, { headers });
                                executionResult = { status: "Success", ts: res.data.ts };
                            }
                        } catch (err: any) { executionResult = { error: `Slack Error: ${err.response?.data?.error || err.message}` }; }
                    }
                }

                // =========================================
                // DATA AGENTS 
                // =========================================
                else if (toolUse.name === 'airtable_data_agent') {
                    const AIRTABLE_API_KEY = ephemeralSecrets.airtableApiKey;
                    if (!AIRTABLE_API_KEY) {
                        executionResult = { error: "Missing Airtable API Key. You MUST call 'request_secure_credentials' with serviceName 'airtable' to proceed." };
                    } else {
                        try {
                            if (toolInput.action === 'INSPECT_SCHEMA') {
                                const res = await axios.get(`https://api.airtable.com/v0/meta/bases/${toolInput.baseId}/tables`, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
                                executionResult = { status: "Success", tables: res.data.tables.map((t: any) => ({ name: t.name, id: t.id })) };
                            } else if (toolInput.action === 'INGEST_SPREADSHEET' && toolInput.fileUrl) {
                                const fileRes = await axios.get(toolInput.fileUrl, { responseType: 'arraybuffer' });
                                const workbook = xlsx.read(fileRes.data, { type: 'buffer' });
                                executionResult = { status: "Success", sheetCount: workbook.SheetNames.length };
                            }
                        } catch (err: any) { executionResult = { error: err.message }; }
                    }
                }
                
                else if (toolUse.name === 'snowflake_data_agent') {
                    const sfAccount = ephemeralSecrets.snowflakeAccount;
                    const sfUser = ephemeralSecrets.snowflakeUser;
                    const sfPrivateKey = ephemeralSecrets.snowflakePrivateKey;
                    if (!sfAccount || !sfUser || !sfPrivateKey) {
                        executionResult = { error: "Missing Snowflake credentials. Call 'request_secure_credentials' with serviceName 'snowflake'." };
                    } else {
                        try {
                            const token = generateSnowflakeJWT(sfAccount, sfUser, sfPrivateKey);
                            const res = await axios.post(`https://${sfAccount}.snowflakecomputing.com/api/v2/statements`, 
                                { statement: toolInput.sqlQuery, warehouse: "COMPUTE_WH", database: toolInput.database, schema: toolInput.schemaName },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            executionResult = { status: "Success", data: res.data };
                        } catch (err: any) { executionResult = { error: err.message }; }
                    }
                }
                
                else if (toolUse.name === 'airflow_pipeline_agent') {
                    const airflowUrl = ephemeralSecrets.airflowBaseUrl;
                    if (!airflowUrl) {
                        executionResult = { error: "Missing Airflow credentials. Call 'request_secure_credentials' with serviceName 'airflow'." };
                    } else {
                        try {
                            if (toolInput.action === 'GENERATE_AND_DEPLOY_DAG' && toolInput.dagPythonCode) {
                                const validationRes = await lambdaClient.send(new InvokeCommand({ FunctionName: PYTHON_VALIDATOR_LAMBDA_ARN, Payload: Buffer.from(JSON.stringify({ dagPythonCode: toolInput.dagPythonCode })) }));
                                const validationResult = JSON.parse(Buffer.from(validationRes.Payload!).toString());
                                if (!validationResult.valid) {
                                    executionResult = { error: `DAG Validation Failed: ${validationResult.error}` };
                                } else {
                                    executionResult = { status: "Success", message: `DAG deployed.` };
                                }
                            }
                        } catch (err: any) { executionResult = { error: err.message }; }
                    }
                }

                // =========================================
                // ENTERPRISE SOFTWARE DEVELOPMENT
                // =========================================

                else if (toolUse.name === 'github_developer_agent') {
                    const GITHUB_TOKEN = ephemeralSecrets.githubToken;
                    if (!GITHUB_TOKEN) {
                        executionResult = { error: "Missing GitHub Personal Access Token. Call 'request_secure_credentials' with serviceName 'github'." };
                    } else {
                        try {
                            const headers = { 
                                Authorization: `Bearer ${GITHUB_TOKEN}`, 
                                Accept: 'application/vnd.github.v3+json',
                                'X-GitHub-Api-Version': '2022-11-28'
                            };
                            const { action, owner, repo, path, branch, sourceBranch, targetBranch, commitMessage, fileContent, pullRequestTitle, pullRequestBody, pullRequestNumber } = toolInput;
                            const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

                            if (action === 'GET_REPO') {
                                const res = await axios.get(baseUrl, { headers });
                                executionResult = { status: "Success", repository: res.data };
                            } else if (action === 'GET_FILE' && path) {
                                const url = branch ? `${baseUrl}/contents/${path}?ref=${branch}` : `${baseUrl}/contents/${path}`;
                                const res = await axios.get(url, { headers });
                                // Automatically decode GitHub's base64 payload so the LLM can read the raw code
                                const decodedContent = Buffer.from(res.data.content, 'base64').toString('utf-8');
                                executionResult = { status: "Success", fileInfo: { sha: res.data.sha, size: res.data.size, name: res.data.name }, content: decodedContent };
                            } else if (action === 'CREATE_OR_UPDATE_FILE' && path && commitMessage && fileContent) {
                                // 1. Check if file exists to fetch the target SHA (required by GitHub API for updates)
                                let sha: string | undefined;
                                try {
                                    const getRes = await axios.get(`${baseUrl}/contents/${path}${branch ? `?ref=${branch}` : ''}`, { headers });
                                    sha = getRes.data.sha;
                                } catch (e: any) { if (e.response?.status !== 404) throw e; }
                                
                                // 2. Base64 encode the LLM's text output and commit
                                const payload: any = {
                                    message: commitMessage,
                                    content: Buffer.from(fileContent, 'utf-8').toString('base64')
                                };
                                if (sha) payload.sha = sha;
                                if (branch) payload.branch = branch;

                                const res = await axios.put(`${baseUrl}/contents/${path}`, payload, { headers });
                                executionResult = { status: "Success", commit: res.data.commit };
                            } else if (action === 'CREATE_PULL_REQUEST' && sourceBranch && targetBranch) {
                                const payload = { title: pullRequestTitle || "Automated PR", body: pullRequestBody || "", head: sourceBranch, base: targetBranch };
                                const res = await axios.post(`${baseUrl}/pulls`, payload, { headers });
                                executionResult = { status: "Success", pullRequestUrl: res.data.html_url };
                            } else if (action === 'MERGE_PULL_REQUEST' && pullRequestNumber) {
                                const payload: any = {};
                                if (commitMessage) payload.commit_message = commitMessage;
                                const res = await axios.put(`${baseUrl}/pulls/${pullRequestNumber}/merge`, payload, { headers });
                                executionResult = { status: "Success", merged: res.data.merged, sha: res.data.sha };
                            } else {
                                executionResult = { error: `Missing required parameters for GitHub action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `GitHub Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'gitlab_developer_agent') {
                    const GITLAB_TOKEN = ephemeralSecrets.gitlabToken;
                    const GITLAB_DOMAIN = ephemeralSecrets.gitlabDomain || 'gitlab.com';
                    if (!GITLAB_TOKEN) {
                        executionResult = { error: "Missing GitLab Access Token. Call 'request_secure_credentials' with serviceName 'gitlab'." };
                    } else {
                        try {
                            const headers = { 'PRIVATE-TOKEN': GITLAB_TOKEN, Accept: 'application/json' };
                            const { action, projectId, filePath, branch, sourceBranch, targetBranch, commitMessage, fileContent, fileAction, mergeRequestTitle, mergeRequestBody, mergeRequestIid } = toolInput;
                            const encodedProjectId = encodeURIComponent(projectId);
                            const baseUrl = `https://${GITLAB_DOMAIN}/api/v4/projects/${encodedProjectId}`;

                            if (action === 'GET_PROJECT') {
                                const res = await axios.get(baseUrl, { headers });
                                executionResult = { status: "Success", project: res.data };
                            } else if (action === 'GET_FILE' && filePath && branch) {
                                const encodedPath = encodeURIComponent(filePath);
                                const res = await axios.get(`${baseUrl}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`, { headers });
                                const decodedContent = Buffer.from(res.data.content, 'base64').toString('utf-8');
                                executionResult = { status: "Success", fileInfo: { commit_id: res.data.commit_id, size: res.data.size, file_name: res.data.file_name }, content: decodedContent };
                            } else if (action === 'COMMIT_FILE' && branch && commitMessage && filePath && fileAction) {
                                const payload = {
                                    branch: branch,
                                    commit_message: commitMessage,
                                    actions: [{ action: fileAction, file_path: filePath, content: fileContent || "" }]
                                };
                                const res = await axios.post(`${baseUrl}/repository/commits`, payload, { headers });
                                executionResult = { status: "Success", commitId: res.data.id };
                            } else if (action === 'CREATE_MERGE_REQUEST' && sourceBranch && targetBranch) {
                                const payload = { source_branch: sourceBranch, target_branch: targetBranch, title: mergeRequestTitle || "Automated MR", description: mergeRequestBody || "" };
                                const res = await axios.post(`${baseUrl}/merge_requests`, payload, { headers });
                                executionResult = { status: "Success", mergeRequestUrl: res.data.web_url };
                            } else if (action === 'ACCEPT_MERGE_REQUEST' && mergeRequestIid) {
                                const payload: any = {};
                                if (commitMessage) payload.merge_commit_message = commitMessage;
                                const res = await axios.put(`${baseUrl}/merge_requests/${mergeRequestIid}/merge`, payload, { headers });
                                executionResult = { status: "Success", mergeCommitSha: res.data.merge_commit_sha };
                            } else {
                                executionResult = { error: `Missing required parameters for GitLab action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `GitLab Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                // =========================================
                // ENTERPRISE SITE RELIABILITY ENGINEERING (SRE)
                // =========================================

                else if (toolUse.name === 'grafana_sre_agent') {
                    const GRAFANA_URL = ephemeralSecrets.grafanaUrl; // e.g. https://your-org.grafana.net
                    const GRAFANA_TOKEN = ephemeralSecrets.grafanaToken;
                    
                    if (!GRAFANA_URL || !GRAFANA_TOKEN) {
                        executionResult = { error: "Missing Grafana credentials. Call 'request_secure_credentials' with serviceName 'grafana'." };
                    } else {
                        try {
                            const headers = { 
                                Authorization: `Bearer ${GRAFANA_TOKEN}`, 
                                Accept: 'application/json',
                                'Content-Type': 'application/json' 
                            };
                            const { action, dataSourceUid, query, dashboardJson, timeRange } = toolInput;
                            
                            // Strip trailing slash if present
                            const baseUrl = GRAFANA_URL.replace(/\/$/, "");

                            if (action === 'GET_DATA_SOURCES') {
                                const res = await axios.get(`${baseUrl}/api/datasources`, { headers });
                                // Filter down payload to fit context window
                                executionResult = { status: "Success", dataSources: res.data.map((ds: any) => ({ id: ds.id, uid: ds.uid, name: ds.name, type: ds.type })) };
                            } else if (action === 'QUERY_METRICS' && dataSourceUid && query) {
                                // Routes PromQL through Grafana's Data Source Proxy
                                const res = await axios.get(`${baseUrl}/api/datasources/proxy/uid/${dataSourceUid}/api/v1/query?query=${encodeURIComponent(query)}`, { headers });
                                executionResult = { status: "Success", metrics: res.data.data.result };
                            } else if (action === 'QUERY_LOKI_LOGS' && dataSourceUid && query) {
                                // Routes LogQL through Grafana's Data Source Proxy
                                const range = timeRange || "1h";
                                const res = await axios.get(`${baseUrl}/api/datasources/proxy/uid/${dataSourceUid}/loki/api/v1/query?query=${encodeURIComponent(query)}`, { headers });
                                executionResult = { status: "Success", logs: res.data.data.result };
                            } else if (action === 'CREATE_DASHBOARD' && dashboardJson) {
                                const payload = {
                                    dashboard: JSON.parse(dashboardJson),
                                    overwrite: true,
                                    message: "Provisioned automatically by Vanguard Agent"
                                };
                                const res = await axios.post(`${baseUrl}/api/dashboards/db`, payload, { headers });
                                executionResult = { status: "Success", dashboardUrl: `${baseUrl}${res.data.url}` };
                            } else {
                                executionResult = { error: `Missing required parameters for Grafana action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Grafana Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'datadog_sre_agent') {
                    const DD_API_KEY = ephemeralSecrets.datadogApiKey;
                    const DD_APP_KEY = ephemeralSecrets.datadogAppKey;
                    const DD_SITE = ephemeralSecrets.datadogSite || 'datadoghq.com';
                    
                    if (!DD_API_KEY || !DD_APP_KEY) {
                        executionResult = { error: "Missing Datadog API/App Keys. Call 'request_secure_credentials' with serviceName 'datadog'." };
                    } else {
                        try {
                            const headers = { 
                                'DD-API-KEY': DD_API_KEY, 
                                'DD-APPLICATION-KEY': DD_APP_KEY,
                                Accept: 'application/json',
                                'Content-Type': 'application/json' 
                            };
                            const { action, query, from, to, dashboardJson } = toolInput;
                            const baseUrl = `https://api.${DD_SITE}/api`;

                            if (action === 'QUERY_LOGS') {
                                // Datadog v2 Logs Search
                                const payload = {
                                    filter: { query: query || "*", from: from ? from * 1000 : "now-1h", to: to ? to * 1000 : "now" },
                                    page: { limit: 50 }
                                };
                                const res = await axios.post(`https://api.${DD_SITE}/api/v2/logs/events/search`, payload, { headers });
                                executionResult = { status: "Success", logs: res.data.data };
                            } else if (action === 'QUERY_METRICS' && query && from && to) {
                                // Datadog v1 Metrics Query
                                const res = await axios.get(`${baseUrl}/v1/query?query=${encodeURIComponent(query)}&from=${from}&to=${to}`, { headers });
                                executionResult = { status: "Success", series: res.data.series };
                            } else if (action === 'CREATE_DASHBOARD' && dashboardJson) {
                                const res = await axios.post(`${baseUrl}/v1/dashboard`, JSON.parse(dashboardJson), { headers });
                                executionResult = { status: "Success", dashboardUrl: `https://app.${DD_SITE}/dashboard/${res.data.id}` };
                            } else if (action === 'SEARCH_DASHBOARDS') {
                                const res = await axios.get(`${baseUrl}/v1/dashboard`, { headers });
                                executionResult = { status: "Success", dashboards: res.data.dashboards?.slice(0, 20) };
                            } else {
                                executionResult = { error: `Missing required parameters for Datadog action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Datadog Error: ${err.response?.data?.errors?.[0] || err.message}` }; }
                    }
                }

                // =========================================
                // ENTERPRISE PROPERTY MANAGEMENT
                // =========================================

                else if (toolUse.name === 'butterflymx_access_agent') {
                    const BMX_TOKEN = ephemeralSecrets.butterflyMxToken;
                    
                    if (!BMX_TOKEN) {
                        executionResult = { error: "Missing ButterflyMX Access Token. Call 'request_secure_credentials' with serviceName 'butterflymx'." };
                    } else {
                        try {
                            const headers = { 
                                Authorization: `Bearer ${BMX_TOKEN}`, 
                                Accept: 'application/vnd.api+json',
                                'Content-Type': 'application/vnd.api+json' 
                            };
                            const { action, buildingId, tenantId, deviceId, virtualKeyData } = toolInput;
                            const baseUrl = `https://api.butterflymx.com/v3`;

                            if (action === 'GET_BUILDINGS') {
                                const res = await axios.get(`${baseUrl}/buildings`, { headers });
                                executionResult = { status: "Success", buildings: res.data.data };
                            } else if (action === 'GET_TENANTS' && buildingId) {
                                const res = await axios.get(`${baseUrl}/buildings/${buildingId}/tenants`, { headers });
                                executionResult = { status: "Success", tenants: res.data.data };
                            } else if (action === 'GET_ACCESS_LOGS' && buildingId) {
                                const res = await axios.get(`${baseUrl}/buildings/${buildingId}/access_logs?page[limit]=20`, { headers });
                                executionResult = { status: "Success", logs: res.data.data };
                            } else if (action === 'OPEN_DOOR' && deviceId) {
                                // Executes a remote door release
                                const res = await axios.post(`${baseUrl}/devices/${deviceId}/open`, {}, { headers });
                                executionResult = { status: "Success", message: "Door release command sent successfully.", data: res.data };
                            } else if (action === 'CREATE_VIRTUAL_KEY' && buildingId && virtualKeyData) {
                                const payload = { data: { type: "virtual_keys", attributes: JSON.parse(virtualKeyData) } };
                                const res = await axios.post(`${baseUrl}/buildings/${buildingId}/virtual_keys`, payload, { headers });
                                executionResult = { status: "Success", virtualKey: res.data.data };
                            } else {
                                executionResult = { error: `Missing required parameters for ButterflyMX action: ${action}` };
                            }
                        } catch (err: any) { 
                            executionResult = { error: `ButterflyMX Error: ${err.response?.data?.errors?.[0]?.detail || err.message}` }; 
                        }
                    }
                }

                else if (toolUse.name === 'yardi_rentcafe_agent') {
                    const YARDI_TOKEN = ephemeralSecrets.yardiToken;
                    const YARDI_PROPERTY_ID = ephemeralSecrets.yardiPropertyId;
                    const YARDI_MCP_URL = process.env.YARDI_MCP_URL || 'https://virtuoso.yardi.com/mcp'; // Configure this in backend.ts
                    
                    if (!YARDI_TOKEN) {
                        executionResult = { error: "Missing Yardi Virtuoso credentials. Call 'request_secure_credentials' with serviceName 'yardi'." };
                    } else {
                        try {
                            const headers: any = { 
                                Authorization: `Bearer ${YARDI_TOKEN}`, 
                                'Content-Type': 'application/json' 
                            };
                            if (YARDI_PROPERTY_ID) headers['X-Yardi-Property-Id'] = YARDI_PROPERTY_ID;

                            const { mcpToolName, mcpArguments } = toolInput;
                            
                            // Proxy request directly to dedicated Yardi MCP endpoint at https://virtuoso.yardi.com/mcp/tools/call
                            const res = await axios.post(`${YARDI_MCP_URL}/tools/call`, { 
                                name: mcpToolName, 
                                arguments: JSON.parse(mcpArguments || '{}') 
                            }, { headers, timeout: 25000 });
                            
                            executionResult = { status: "Success", data: res.data };
                        } catch (err: any) { 
                            // Check if the Yardi MCP rejected Authentication token
                            if (err.response?.status === 401 || err.response?.status === 403) {
                                executionResult = { error: "Yardi Virtuoso credentials expired or invalid. Call 'request_secure_credentials' with serviceName 'yardi'." };
                            } else {
                                executionResult = { error: `Yardi MCP Error: ${err.response?.data?.error || err.message}` }; 
                            }
                        }
                    }
                }

                // =========================================
                // ENTERPRISE CORE BUSINESS OPERATIONS
                // =========================================

                else if (toolUse.name === 'salesforce_crm_agent') {
                    const SF_URL = ephemeralSecrets.salesforceInstanceUrl;
                    const SF_TOKEN = ephemeralSecrets.salesforceAccessToken;
                    if (!SF_URL || !SF_TOKEN) {
                        executionResult = { error: "Missing Salesforce credentials. Call 'request_secure_credentials' with serviceName 'salesforce'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${SF_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, query, objectName, recordId, recordData } = toolInput;
                            const baseUrl = `${SF_URL.replace(/\/$/, "")}/services/data/v58.0`;

                            if (action === 'SOQL_QUERY' && query) {
                                const res = await axios.get(`${baseUrl}/query/?q=${encodeURIComponent(query)}`, { headers });
                                executionResult = { status: "Success", records: res.data.records };
                            } else if (action === 'GET_RECORD' && objectName && recordId) {
                                const res = await axios.get(`${baseUrl}/sobjects/${objectName}/${recordId}`, { headers });
                                executionResult = { status: "Success", record: res.data };
                            } else if (action === 'CREATE_RECORD' && objectName && recordData) {
                                const res = await axios.post(`${baseUrl}/sobjects/${objectName}/`, JSON.parse(recordData), { headers });
                                executionResult = { status: "Success", result: res.data };
                            } else if (action === 'UPDATE_RECORD' && objectName && recordId && recordData) {
                                await axios.patch(`${baseUrl}/sobjects/${objectName}/${recordId}`, JSON.parse(recordData), { headers });
                                executionResult = { status: "Success", message: "Record updated." };
                            } else {
                                executionResult = { error: `Missing required parameters for Salesforce action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Salesforce Error: ${err.response?.data?.[0]?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'sap_erp_agent') {
                    const SAP_URL = ephemeralSecrets.sapBaseUrl;
                    const SAP_USER = ephemeralSecrets.sapUsername;
                    const SAP_PASS = ephemeralSecrets.sapPassword;
                    if (!SAP_URL || !SAP_USER || !SAP_PASS) {
                        executionResult = { error: "Missing SAP credentials. Call 'request_secure_credentials' with serviceName 'sap'." };
                    } else {
                        try {
                            const authString = Buffer.from(`${SAP_USER}:${SAP_PASS}`).toString('base64');
                            const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json', 'Content-Type': 'application/json' };
                            const { action, endpoint, payload } = toolInput;
                            const baseUrl = SAP_URL.replace(/\/$/, "");

                            if (action === 'ODATA_GET') {
                                const res = await axios.get(`${baseUrl}${endpoint}`, { headers });
                                executionResult = { status: "Success", data: res.data.d || res.data };
                            } else if (action === 'ODATA_POST') {
                                const res = await axios.post(`${baseUrl}${endpoint}`, JSON.parse(payload || '{}'), { headers });
                                executionResult = { status: "Success", data: res.data.d || res.data };
                            }
                        } catch (err: any) { executionResult = { error: `SAP Error: ${err.response?.data?.error?.message?.value || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'dynamics_365_agent') {
                    const D365_URL = ephemeralSecrets.dynamicsInstanceUrl;
                    const D365_TOKEN = ephemeralSecrets.dynamicsAccessToken;
                    if (!D365_URL || !D365_TOKEN) {
                        executionResult = { error: "Missing Dynamics 365 credentials. Call 'request_secure_credentials' with serviceName 'dynamics'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${D365_TOKEN}`, 'Content-Type': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' };
                            const { action, entityPluralName, queryOptions, recordId, payload } = toolInput;
                            const baseUrl = `${D365_URL.replace(/\/$/, "")}/api/data/v9.2`;

                            if (action === 'RETRIEVE_RECORDS') {
                                const q = queryOptions ? `?${queryOptions}` : '';
                                const res = await axios.get(`${baseUrl}/${entityPluralName}${q}`, { headers });
                                executionResult = { status: "Success", records: res.data.value };
                            } else if (action === 'CREATE_RECORD' && payload) {
                                const res = await axios.post(`${baseUrl}/${entityPluralName}`, JSON.parse(payload), { headers });
                                executionResult = { status: "Success", recordId: res.headers['odata-entityid'] };
                            } else if (action === 'UPDATE_RECORD' && recordId && payload) {
                                await axios.patch(`${baseUrl}/${entityPluralName}(${recordId})`, JSON.parse(payload), { headers });
                                executionResult = { status: "Success", message: "Record updated." };
                            } else {
                                executionResult = { error: `Missing required parameters for Dynamics action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Dynamics 365 Error: ${err.response?.data?.error?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'hubspot_crm_agent') {
                    const HS_TOKEN = ephemeralSecrets.hubspotAccessToken;
                    if (!HS_TOKEN) {
                        executionResult = { error: "Missing HubSpot credentials. Call 'request_secure_credentials' with serviceName 'hubspot'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, objectType, objectId, searchQuery, payload } = toolInput;
                            const baseUrl = `https://api.hubapi.com/crm/v3/objects/${objectType}`;

                            if (action === 'SEARCH_OBJECTS') {
                                const res = await axios.post(`${baseUrl}/search`, JSON.parse(searchQuery || '{}'), { headers });
                                executionResult = { status: "Success", results: res.data.results };
                            } else if (action === 'GET_OBJECT' && objectId) {
                                const res = await axios.get(`${baseUrl}/${objectId}`, { headers });
                                executionResult = { status: "Success", result: res.data };
                            } else if (action === 'CREATE_OBJECT') {
                                const res = await axios.post(baseUrl, { properties: JSON.parse(payload || '{}') }, { headers });
                                executionResult = { status: "Success", result: res.data };
                            } else if (action === 'UPDATE_OBJECT' && objectId) {
                                const res = await axios.patch(`${baseUrl}/${objectId}`, { properties: JSON.parse(payload || '{}') }, { headers });
                                executionResult = { status: "Success", result: res.data };
                            } else {
                                executionResult = { error: `Missing required parameters for HubSpot action.` };
                            }
                        } catch (err: any) { executionResult = { error: `HubSpot Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'linkedin_sales_agent') {
                    const LI_TOKEN = ephemeralSecrets.linkedInAccessToken;
                    if (!LI_TOKEN) {
                        executionResult = { error: "Missing LinkedIn credentials. Call 'request_secure_credentials' with serviceName 'linkedin'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${LI_TOKEN}`, 'X-Restli-Protocol-Version': '2.0.0' };
                            const { action, query, accountId } = toolInput;
                            if (action === 'SEARCH_LEADS') {
                                const res = await axios.get(`https://api.linkedin.com/v2/salesNavigatorLeads?q=${encodeURIComponent(query || '')}`, { headers });
                                executionResult = { status: "Success", leads: res.data.elements };
                            } else if (action === 'GET_ACCOUNT' && accountId) {
                                const res = await axios.get(`https://api.linkedin.com/v2/salesNavigatorAccounts/${accountId}`, { headers });
                                executionResult = { status: "Success", account: res.data };
                            }
                        } catch (err: any) { executionResult = { error: `LinkedIn Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'uipath_rpa_agent') {
                    const UI_URL = ephemeralSecrets.uipathOrchestratorUrl;
                    const UI_ORG = ephemeralSecrets.uipathOrganizationName;
                    const UI_TENANT = ephemeralSecrets.uipathTenantName;
                    const UI_TOKEN = ephemeralSecrets.uipathAccessToken;
                    
                    if (!UI_URL || !UI_ORG || !UI_TENANT || !UI_TOKEN) {
                        executionResult = { error: "Missing UiPath credentials. Call 'request_secure_credentials' with serviceName 'uipath'." };
                    } else {
                        try {
                            const headers = { 
                                Authorization: `Bearer ${UI_TOKEN}`, 
                                'Content-Type': 'application/json',
                                'X-UIPATH-OrganizationUnitId': ephemeralSecrets.uipathFolderId || '1' 
                            };
                            const { action, releaseKey, jobId, queueName, payload } = toolInput;
                            const baseUrl = `${UI_URL.replace(/\/$/, "")}/${UI_ORG}/${UI_TENANT}/orchestrator_/odata`;

                            if (action === 'GET_JOBS') {
                                const res = await axios.get(`${baseUrl}/Jobs?$top=20&$orderby=CreationTime desc`, { headers });
                                executionResult = { status: "Success", jobs: res.data.value };
                            } else if (action === 'START_JOB' && releaseKey) {
                                const body = { startInfo: { ReleaseKey: releaseKey, Strategy: "All", InputArguments: payload || "{}" } };
                                const res = await axios.post(`${baseUrl}/Jobs/UiPath.Server.Configuration.OData.StartJobs`, body, { headers });
                                executionResult = { status: "Success", jobsStarted: res.data.value };
                            } else if (action === 'STOP_JOB' && jobId) {
                                await axios.post(`${baseUrl}/Jobs(${jobId})/UiPath.Server.Configuration.OData.StopJob`, { strategy: "Kill" }, { headers });
                                executionResult = { status: "Success", message: "Job termination requested." };
                            } else if (action === 'GET_QUEUE_ITEMS') {
                                const res = await axios.get(`${baseUrl}/QueueItems?$filter=QueueName eq '${queueName}'`, { headers });
                                executionResult = { status: "Success", items: res.data.value };
                            } else if (action === 'ADD_QUEUE_ITEM' && queueName) {
                                const body = { itemData: { Name: queueName, SpecificContent: JSON.parse(payload || '{}') } };
                                const res = await axios.post(`${baseUrl}/Queues/UiPathODataSvc.AddQueueItem`, body, { headers });
                                executionResult = { status: "Success", item: res.data };
                            } else {
                                executionResult = { error: `Missing required parameters for UiPath action.` };
                            }
                        } catch (err: any) { executionResult = { error: `UiPath Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                // =========================================
                // ENTERPRISE TRAVEL BOOKING & RESERVATION
                // =========================================

                else if (toolUse.name === 'booking_com_travel_agent') {
                    const BCOM_AFFILIATE = ephemeralSecrets.bookingAffiliateId;
                    const BCOM_TOKEN = ephemeralSecrets.bookingToken;
                    if (!BCOM_AFFILIATE || !BCOM_TOKEN) {
                        executionResult = { error: "Missing Booking.com credentials. Call 'request_secure_credentials' with serviceName 'booking'." };
                    } else {
                        try {
                            const headers = { 
                                Authorization: `Bearer ${BCOM_TOKEN}`, 
                                'X-Affiliate-Id': BCOM_AFFILIATE,
                                'Content-Type': 'application/json' 
                            };
                            const { action, query, propertyId, orderId, checkIn, checkOut } = toolInput;
                            const baseUrl = `https://demandapi.booking.com/3.2`;

                            if (action === 'SEARCH_PROPERTIES') {
                                const res = await axios.get(`${baseUrl}/accommodations/search?query=${encodeURIComponent(query || '')}&checkin=${checkIn}&checkout=${checkOut}`, { headers });
                                executionResult = { status: "Success", properties: res.data.results };
                            } else if (action === 'GET_PROPERTY_DETAILS' && propertyId) {
                                const res = await axios.get(`${baseUrl}/accommodations/${propertyId}/details`, { headers });
                                executionResult = { status: "Success", details: res.data };
                            } else if (action === 'GET_REVIEWS' && propertyId) {
                                const res = await axios.get(`${baseUrl}/accommodations/${propertyId}/reviews`, { headers });
                                executionResult = { status: "Success", reviews: res.data.reviews?.slice(0, 20) };
                            } else if (action === 'GET_ORDER_DETAILS' && orderId) {
                                const res = await axios.get(`${baseUrl}/orders/${orderId}`, { headers });
                                executionResult = { status: "Success", order: res.data };
                            } else {
                                executionResult = { error: `Missing required parameters for Booking.com action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Booking.com Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'priceline_travel_agent') {
                    const PL_TOKEN = ephemeralSecrets.pricelineApiKey;
                    if (!PL_TOKEN) {
                        executionResult = { error: "Missing Priceline Partner credentials. Call 'request_secure_credentials' with serviceName 'priceline'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${PL_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, destination, hotelId, reservationId } = toolInput;
                            const baseUrl = `https://api.pricelinepartnersolutions.com/v3`;

                            if (action === 'SEARCH_HOTELS' && destination) {
                                const res = await axios.get(`${baseUrl}/hotels/search?destination=${encodeURIComponent(destination)}`, { headers });
                                executionResult = { status: "Success", hotels: res.data.hotels };
                            } else if (action === 'GET_HOTEL_DETAILS' && hotelId) {
                                const res = await axios.get(`${baseUrl}/hotels/${hotelId}`, { headers });
                                executionResult = { status: "Success", details: res.data };
                            } else if (action === 'GET_REVIEWS' && hotelId) {
                                const res = await axios.get(`${baseUrl}/hotels/${hotelId}/reviews`, { headers });
                                executionResult = { status: "Success", reviews: res.data.reviews };
                            } else if (action === 'GET_RESERVATION' && reservationId) {
                                const res = await axios.get(`${baseUrl}/reservations/${reservationId}`, { headers });
                                executionResult = { status: "Success", reservation: res.data };
                            } else {
                                executionResult = { error: `Missing required parameters for Priceline action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Priceline Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'vrbo_property_agent') {
                    const VRBO_PARTNER_ID = ephemeralSecrets.vrboPartnerId;
                    const VRBO_API_KEY = ephemeralSecrets.vrboApiKey;
                    if (!VRBO_PARTNER_ID || !VRBO_API_KEY) {
                        executionResult = { error: "Missing Expedia/Vrbo credentials. Call 'request_secure_credentials' with serviceName 'vrbo'." };
                    } else {
                        try {
                            const headers = { 
                                Authorization: `Bearer ${VRBO_API_KEY}`,
                                'Partner-Id': VRBO_PARTNER_ID,
                                'Content-Type': 'application/json' 
                            };
                            const { action, propertyId, reservationId, payload, startDate, endDate } = toolInput;
                            const baseUrl = `https://api.expediagroup.com/v1/vrbo`;

                            if (action === 'GET_LISTING' && propertyId) {
                                const res = await axios.get(`${baseUrl}/properties/${propertyId}`, { headers });
                                executionResult = { status: "Success", listing: res.data };
                            } else if (action === 'UPDATE_RATES' && propertyId && payload) {
                                const res = await axios.post(`${baseUrl}/properties/${propertyId}/rates`, JSON.parse(payload), { headers });
                                executionResult = { status: "Success", message: "Rates updated successfully." };
                            } else if (action === 'GET_AVAILABILITY' && propertyId && startDate && endDate) {
                                const res = await axios.get(`${baseUrl}/properties/${propertyId}/availability?start=${startDate}&end=${endDate}`, { headers });
                                executionResult = { status: "Success", calendar: res.data };
                            } else if (action === 'GET_RESERVATION' && reservationId) {
                                const res = await axios.get(`${baseUrl}/reservations/${reservationId}`, { headers });
                                executionResult = { status: "Success", reservation: res.data };
                            } else if (action === 'GET_REVIEWS' && propertyId) {
                                const res = await axios.get(`${baseUrl}/properties/${propertyId}/reviews`, { headers });
                                executionResult = { status: "Success", reviews: res.data.reviews };
                            } else {
                                executionResult = { error: `Missing required parameters for Vrbo action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Vrbo Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                // =========================================
                // ENTERPRISE SMART HOME MANAGEMENT
                // =========================================

                else if (toolUse.name === 'google_home_agent') {
                    const GH_PROJECT = ephemeralSecrets.googleHomeProjectId;
                    const GH_TOKEN = ephemeralSecrets.googleHomeToken;
                    
                    if (!GH_PROJECT || !GH_TOKEN) {
                        executionResult = { error: "Missing Google Home credentials. Call 'request_secure_credentials' with serviceName 'google_home'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, deviceId, command, params, roomAction, roomName } = toolInput;
                            const baseUrl = `https://smartdevicemanagement.googleapis.com/v1/enterprises/${GH_PROJECT}`;

                            if (action === 'GET_DEVICES') {
                                const res = await axios.get(`${baseUrl}/devices`, { headers });
                                executionResult = { status: "Success", devices: res.data.devices };
                            } else if (action === 'CONTROL_DEVICE' && deviceId && command) {
                                const payload = { command: command, params: JSON.parse(params || '{}') };
                                const res = await axios.post(`${baseUrl}/devices/${deviceId}:executeCommand`, payload, { headers });
                                executionResult = { status: "Success", results: res.data };
                            } else if (action === 'GET_ROOMS') {
                                const res = await axios.get(`${baseUrl}/structures`, { headers });
                                executionResult = { status: "Success", structures: res.data.structures };
                            } else if (action === 'MANAGE_ROOM') {
                                executionResult = { error: "Google Smart Device Management (SDM) API restricts third-party applications from programmatically creating, deleting, or renaming rooms/structures. Inform the user they must perform layout changes directly in the Google Home App." };
                            } else {
                                executionResult = { error: `Missing required parameters for Google Home action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Google Home Error: ${err.response?.data?.error?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'apple_homekit_agent') {
                    const HA_URL = ephemeralSecrets.homeAssistantUrl;
                    const HA_TOKEN = ephemeralSecrets.homeAssistantToken;
                    
                    if (!HA_URL || !HA_TOKEN) {
                        executionResult = { error: "Missing Apple HomeKit / Home Assistant credentials. Call 'request_secure_credentials' with serviceName 'homekit'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, entityId, domain, service, serviceData, roomAction } = toolInput;
                            const baseUrl = `${HA_URL.replace(/\/$/, "")}/api`;

                            if (action === 'GET_DEVICES') {
                                const res = await axios.get(`${baseUrl}/states`, { headers });
                                executionResult = { status: "Success", devices: res.data };
                            } else if (action === 'CONTROL_DEVICE' && domain && service) {
                                const payload = serviceData ? JSON.parse(serviceData) : {};
                                if (entityId) payload.entity_id = entityId;
                                const res = await axios.post(`${baseUrl}/services/${domain}/${service}`, payload, { headers });
                                executionResult = { status: "Success", changedStates: res.data };
                            } else if (action === 'GET_ROOMS') {
                                const res = await axios.post(`${baseUrl}/template`, { template: "{{ areas() }}" }, { headers });
                                executionResult = { status: "Success", areas: res.data };
                            } else if (action === 'MANAGE_ROOM') {
                                executionResult = { error: "The Home Assistant REST API does not support Area/Room mutation. Area management requires direct registry access or undocumented WebSocket commands. Inform the user this action is unsupported via text." };
                            } else {
                                executionResult = { error: `Missing required parameters for HomeKit action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `HomeKit Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                else if (toolUse.name === 'amazon_alexa_smarthome_agent') {
                    const ALEXA_TOKEN = ephemeralSecrets.alexaToken;
                    
                    if (!ALEXA_TOKEN) {
                        executionResult = { error: "Missing Amazon Alexa credentials. Call 'request_secure_credentials' with serviceName 'alexa'." };
                    } else {
                        try {
                            const headers = { Authorization: `Bearer ${ALEXA_TOKEN}`, 'Content-Type': 'application/json' };
                            const { action, endpointId, namespace, name, payload } = toolInput;
                            const baseUrl = `https://api.amazonalexa.com/v3`;

                            if (action === 'GET_DEVICES') {
                                executionResult = { error: "Proactive device discovery is not supported via the Alexa Event Gateway. You must rely on the user providing the target device name/ID." };
                            } else if (action === 'CONTROL_DEVICE' && endpointId && namespace && name) {
                                const eventPayload = {
                                    context: {},
                                    event: {
                                        header: { namespace: namespace, name: name, payloadVersion: "3", messageId: Date.now().toString() },
                                        endpoint: { endpointId: endpointId },
                                        payload: JSON.parse(payload || '{}')
                                    }
                                };
                                const res = await axios.post(`${baseUrl}/events`, eventPayload, { headers });
                                executionResult = { status: "Success", eventResponse: res.data };
                            } else if (action === 'GET_ROOMS' || action === 'MANAGE_ROOM') {
                                executionResult = { error: "Alexa Smart Home Skill API strictly prohibits third-party group/room management. Inform the user they must manage their Alexa Groups directly in the Alexa App." };
                            } else {
                                executionResult = { error: `Missing required parameters for Alexa action: ${action}` };
                            }
                        } catch (err: any) { executionResult = { error: `Alexa Error: ${err.response?.data?.message || err.message}` }; }
                    }
                }

                // =========================================
                // ENTERPRISE FULL STACK DEVELOPER (MCPs)
                // =========================================

                else if (toolUse.name === 'mito_mcp_agent') {
                    const MITO_URL = process.env.MITO_MCP_URL;
                    const MITO_TOKEN = ephemeralSecrets.mitoToken;
                    
                    if (!MITO_URL) {
                        executionResult = { error: "Mito MCP URL is not configured in the backend environment variables." };
                    } else {
                        try {
                            const headers: any = { 'Content-Type': 'application/json' };
                            if (MITO_TOKEN) headers['Authorization'] = `Bearer ${MITO_TOKEN}`;

                            const { action, mcpToolName, mcpArguments } = toolInput;
                            
                            if (action === 'LIST_TOOLS') {
                                const res = await axios.post(`${MITO_URL}/tools/list`, {}, { headers, timeout: 10000 });
                                executionResult = { status: "Success", tools: res.data.tools };
                            } else if (action === 'CALL_TOOL' && mcpToolName) {
                                const res = await axios.post(`${MITO_URL}/tools/call`, { 
                                    name: mcpToolName, 
                                    arguments: JSON.parse(mcpArguments || '{}') 
                                }, { headers, timeout: 25000 });
                                executionResult = { status: "Success", data: res.data };
                            } else {
                                executionResult = { error: "Missing mcpToolName for CALL_TOOL action." };
                            }
                        } catch (err: any) { 
                            if (err.response?.status === 401) {
                                executionResult = { error: "Missing or invalid Mito credentials. Call 'request_secure_credentials' with serviceName 'mito'." };
                            } else {
                                executionResult = { error: `Mito MCP Error: ${err.response?.data?.error || err.message}` }; 
                            }
                        }
                    }
                }

                else if (toolUse.name === 'apotheosis_mcp_agent') {
                    const APOTHEOSIS_URL = process.env.APOTHEOSIS_MCP_URL;
                    const APOTHEOSIS_TOKEN = ephemeralSecrets.apotheosisToken; 

                    if (!APOTHEOSIS_URL) {
                        executionResult = { error: "Apotheosis MCP URL is not configured in the backend environment variables." };
                    } else {
                        try {
                            const headers: any = { 'Content-Type': 'application/json' };
                            if (APOTHEOSIS_TOKEN) headers['Authorization'] = `Bearer ${APOTHEOSIS_TOKEN}`;

                            const { action, mcpToolName, mcpArguments } = toolInput;
                            
                            if (action === 'LIST_TOOLS') {
                                const res = await axios.post(`${APOTHEOSIS_URL}/tools/list`, {}, { headers, timeout: 10000 });
                                executionResult = { status: "Success", tools: res.data.tools };
                            } else if (action === 'CALL_TOOL' && mcpToolName) {
                                const res = await axios.post(`${APOTHEOSIS_URL}/tools/call`, { 
                                    name: mcpToolName, 
                                    arguments: JSON.parse(mcpArguments || '{}') 
                                }, { headers, timeout: 25000 });
                                executionResult = { status: "Success", data: res.data };
                            } else {
                                executionResult = { error: "Missing mcpToolName for CALL_TOOL action." };
                            }
                        } catch (err: any) { 
                            if (err.response?.status === 401) {
                                executionResult = { error: "Missing or invalid Apotheosis credentials. Call 'request_secure_credentials' with serviceName 'apotheosis'." };
                            } else {
                                executionResult = { error: `Apotheosis MCP Error: ${err.response?.data?.error || err.message}` }; 
                            }
                        }
                    }
                }

                // =========================================
                // BRING YOUR OWN MCP (BYOMCP)
                // =========================================

                else if (toolUse.name === 'custom_mcp_agent') {
                    const CUSTOM_URL = profile.customMcpUrl;
                    
                    if (!CUSTOM_URL) {
                        executionResult = { error: "Custom MCP URL is not configured or is invalid." };
                    } else {
                        try {
                            const headers: any = { 'Content-Type': 'application/json' };
                            
                            if (profile.mcpRequiresAuth && profile.mcpAuthToken) {
                                headers['Authorization'] = `Bearer ${profile.mcpAuthToken}`;
                            }

                            const { action, mcpToolName, mcpArguments } = toolInput;
                            
                            if (action === 'LIST_TOOLS') {
                                const res = await axios.post(`${CUSTOM_URL}/tools/list`, {}, { headers, timeout: 10000 });
                                executionResult = { status: "Success", tools: res.data.tools };
                            } else if (action === 'CALL_TOOL' && mcpToolName) {
                                const res = await axios.post(`${CUSTOM_URL}/tools/call`, { 
                                    name: mcpToolName, 
                                    arguments: JSON.parse(mcpArguments || '{}') 
                                }, { headers, timeout: 25000 });
                                executionResult = { status: "Success", data: res.data };
                            } else {
                                executionResult = { error: "Missing mcpToolName for CALL_TOOL action." };
                            }
                        } catch (err: any) { 
                            executionResult = { error: `Custom MCP Error: ${err.response?.data?.error || err.message}` }; 
                        }
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
            
            converseResponse = await bedrockRuntime.send(new ConverseCommand({ modelId: targetModelId, messages: messages, system: [{ text: systemPrompt }] }));
            totalInboundTokens += converseResponse.usage?.inputTokens || 0;
            totalOutboundTokens += converseResponse.usage?.outputTokens || 0;
        }

        const responseText = converseResponse.output?.message?.content?.[0]?.text || "No response generated.";
        const totalDeduction = Math.ceil((totalInboundTokens + totalOutboundTokens) * (MODEL_CREDIT_MULTIPLIERS[targetModelId] || 1)) + flatToolCredits;

        if (totalDeduction > 0) {
            await dynamodb.send(new UpdateCommand({ TableName: USER_PROFILES_TABLE, Key: { cognitoUserId }, UpdateExpression: "SET computeCredits = computeCredits - :cost", ExpressionAttributeValues: { ":cost": totalDeduction } }));
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

function generateSnowflakeJWT(account: string, user: string, key: string): string { return jwt.sign({ iss: `${account.toUpperCase()}.${user.toUpperCase()}`, sub: `${account.toUpperCase()}.${user.toUpperCase()}` }, key, { algorithm: 'RS256' }); }
async function getEmbedding(text: string): Promise<number[]> { try { const res = await bedrockRuntime.send(new InvokeModelCommand({ modelId: "amazon.titan-embed-text-v2:0", contentType: "application/json", accept: "application/json", body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }) })); return JSON.parse(new TextDecoder().decode(res.body)).embedding || []; } catch { return []; } }
function cosineSimilarity(a: number[], b: number[]): number { if (!a.length || !b.length || a.length !== b.length) return 0; let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }
async function processAndUploadImageOutput(bytes: Uint8Array, family: string) { const body = JSON.parse(new TextDecoder().decode(bytes)); const b64 = body.images?.[0] || body.base64; if (!b64) throw new Error("No image data"); const fn = `image-renders/${family}-${Date.now()}.jpeg`; await s3Client.send(new PutObjectCommand({ Bucket: MEDIA_OUTPUT_BUCKET, Key: fn, Body: Buffer.from(b64, "base64"), ContentType: "image/jpeg" })); return { status: "Success", imageUrl: `https://${MEDIA_OUTPUT_BUCKET}.s3.amazonaws.com/${fn}` }; }
async function invokeWebhookRouter(id: string, payload: any) { try { const res = await lambdaClient.send(new InvokeCommand({ FunctionName: WEBHOOK_ROUTER_ARN, Payload: Buffer.from(JSON.stringify({ parameters: [{ name: 'workflowId', value: id }, { name: 'payloadJson', value: JSON.stringify(payload) }] })) })); const out = JSON.parse(Buffer.from(res.Payload!).toString()); return out?.response?.functionResponse?.responseBody?.TEXT?.body ? JSON.parse(out.response.functionResponse.responseBody.TEXT.body) : out; } catch (err: any) { return { error: err.message }; } }
async function getAssignedWorkflows(pid: string) { const m = await dynamodb.send(new QueryCommand({ TableName: PROFILE_WORKFLOWS_TABLE, IndexName: 'byProfile', KeyConditionExpression: 'contextProfileId = :pid', ExpressionAttributeValues: { ':pid': pid } })); const wfs = []; for (const wId of (m.Items?.map(i => i.contextWorkflowId) || [])) { const r = await dynamodb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { id: wId } })); if (r.Item && !r.Item.archived) wfs.push(r.Item); } return wfs; }
async function fetchMcpToolsWithCache(url: string) { const now = Date.now(); if (mcpToolCache[url] && mcpToolCache[url].expiresAt > now) return mcpToolCache[url].tools; try { const res = await axios.post(`${url}/tools/list`, {}, { timeout: 3000 }); const t = (res.data?.tools || []).map((t: any) => ({ toolSpec: { name: sanitizeToolName(t.name), description: t.description || '', inputSchema: { json: t.inputSchema || { type: "object", properties: {} } } } })); mcpToolCache[url] = { tools: t, expiresAt: now + MCP_CACHE_TTL_MS }; return t; } catch { return []; } }
async function executeMcpTool(url: string, name: string, args: any) { try { const res = await axios.post(`${url}/tools/call`, { name, arguments: args }, { timeout: 15000 }); return res.data; } catch (err: any) { return { error: err.message }; } }
function mapToBedrockType(t?: string): string { switch (t?.toLowerCase()) { case 'number': case 'float': return 'number'; case 'boolean': return 'boolean'; case 'array': return 'array'; case 'object': return 'object'; default: return 'string'; } }
function buildJsonSchemaFromParams(params?: any[]) { if (!params || !params.length) return { type: "object", properties: {} }; const props: any = {}; const req: string[] = []; params.forEach(p => { props[p.variable] = { type: mapToBedrockType(p.type), description: p.variable }; if (p.isRequired) req.push(p.variable); }); return { type: "object", properties: props, required: req.length ? req : undefined }; }
function sanitizeToolName(n: string): string { return n.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64); }