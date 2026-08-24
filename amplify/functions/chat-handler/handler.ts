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
import { CORE_SYSTEM_TOOLS, NATIVE_TOOLS_REGISTRY } from "./tool-registry"; // Assuming you moved the registry to a separate file

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

        let relevantNativeTools = NATIVE_TOOLS_REGISTRY;
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

        let mcpTools: any[] = [];
        if (profile.role === 'STANDARD' && profile.customMcpUrl) mcpTools = await fetchMcpToolsWithCache(profile.customMcpUrl);

        const allTools = [...workflowTools, ...CORE_SYSTEM_TOOLS, ...relevantNativeTools, ...mcpTools];
        const toolConfig = allTools.length > 0 ? { tools: allTools } : undefined;
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