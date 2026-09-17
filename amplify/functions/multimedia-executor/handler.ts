import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient } from "@aws-sdk/client-polly";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { TOOL_EXECUTORS } from "../chat-handler/executors"; 

const bedrockRuntime = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const PROFILES_TABLE = process.env.PROFILES_TABLE_NAME!;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const MULTIMODAL_TOOL_FLAT_COSTS: Record<string, number> = { 
    "generate_luma_video": 150000, 
    "generate_image": 30000, 
    "generate_enterprise_image": 4000, 
    "edit_image": 15000,
    "generate_audio": 500,
    "enterprise_voice_agent": 2500,
    "jotform_agile_agent": 500,
    "formstack_agile_agent": 500,
    "generate_document_agent": 100
};

const NOCTURNAL_TOOLS = ['schedule_future_task'];

const INTERNAL_AWS_TOOLS = [
    'schedule_future_task',
    'generate_audio',
    'generate_image',
    'generate_enterprise_image',
    'edit_image',
    'generate_luma_video',
    'generate_luma_video_presentation',
    'generate_document_agent',
    'generate_powerpoint_agent',
    'read_user_attachment',
    'enterprise_voice_agent',
    'execute_qa_agent_task',
    'request_secure_credentials',
    'mito_mcp_agent',
    'apotheosis_mcp_agent',
    'byo_mcp_agent'
];

const resolveManagedToolCredentials = (toolName: string, userIntegrationsJson?: string) => {
    if (!userIntegrationsJson) return null;
    try {
        const integrations = JSON.parse(userIntegrationsJson);
        if (integrations[toolName] && Array.isArray(integrations[toolName]) && integrations[toolName].length > 0) {
            return integrations[toolName].find((c: any) => c.priority) || integrations[toolName][0];
        }
    } catch (e) { 
        console.error("Failed to parse integrations:", e); 
    }
    return null;
};

export const handler = async (event: any) => {
    const actionGroup = event.actionGroup;
    const functionName = event.function;
    const parameters = event.parameters || [];

    const toolInputObject = parameters.reduce((acc: any, p: any) => {
        try { 
            acc[p.name] = (p.value.startsWith('{') || p.value.startsWith('[')) ? JSON.parse(p.value) : p.value; 
        } catch { 
            acc[p.name] = p.value; 
        }
        return acc;
    }, {});

    const sessionAttrs = event.sessionAttributes || event.requestBody?.sessionAttributes || {};
    const promptSessionAttrs = event.promptSessionAttributes || {}; 
    const userId = sessionAttrs.userId || event.userId;
    let responseText = "";

    try {
        if (!userId) throw new Error("Missing user identification in session attributes.");

        const userRes = await dynamodb.send(new GetCommand({ TableName: USER_PROFILES_TABLE, Key: { cognitoUserId: userId } }));
        const dbUser = userRes.Item;
        const availableCredits = dbUser?.computeCredits ?? 0;
        const isNocturnalEnabled = dbUser?.nocturnalAgents === true;

        if (TOOL_EXECUTORS[functionName]) {
            
            if (NOCTURNAL_TOOLS.includes(functionName) && !isNocturnalEnabled) {
                responseText = "Permission Denied: UserProfile.nocturnalAgents is disabled. You cannot schedule tasks. Tell the user they need to enable Nocturnal Agents.";
                return buildActionGroupResponse(actionGroup, functionName, responseText);
            }

            const flatCost = MULTIMODAL_TOOL_FLAT_COSTS[functionName] || 0;
            if (flatCost > 0 && availableCredits < flatCost) {
                responseText = `INSUFFICIENT_CREDITS: Executing ${functionName} requires ${flatCost} compute credits, but you only have ${availableCredits} credits remaining. Please top up your balance.`;
                return buildActionGroupResponse(actionGroup, functionName, responseText);
            }

            const isWorkflow = functionName.startsWith('wf_');
            const toolRequiresAuth = !isWorkflow && !INTERNAL_AWS_TOOLS.includes(functionName);
            let credentials = null;
            
            if (toolRequiresAuth) {
                credentials = resolveManagedToolCredentials(functionName, promptSessionAttrs.injectedIntegrations);
                if (!credentials) {
                    responseText = `Action required: You are missing credentials for ${functionName}. Please navigate to your Integrations settings and connect this service before trying again.`;
                    return buildActionGroupResponse(actionGroup, functionName, responseText);
                }
            }

            let actualProfile: any = { 
                id: sessionAttrs.contextProfileId || 'managed-profile', 
                name: sessionAttrs.contextProfileName || 'Supervisor Agent' 
            };

            if (sessionAttrs.contextProfileId && PROFILES_TABLE) {
                try {
                    const pRes = await dynamodb.send(new GetCommand({ 
                        TableName: PROFILES_TABLE, 
                        Key: { id: sessionAttrs.contextProfileId } 
                    }));
                    if (pRes.Item) actualProfile = pRes.Item;
                } catch (e) {
                    console.warn("Could not fetch full profile for Managed Agent tool execution:", e);
                }
            }

            try {
                const context = {
                    toolInput: toolInputObject,
                    credentials: credentials,
                    ephemeralSecrets: {}, 
                    profile: actualProfile,
                    userProfile: dbUser,
                    cognitoUserId: userId,
                    sessionId: sessionAttrs.terminalId || event.sessionId || `session-${Date.now()}`,
                    citations: [],
                    clients: { 
                        s3: s3Client, polly: pollyClient, bedrockRuntime: bedrockRuntime, 
                        dynamodb: dynamodb, lambda: lambdaClient 
                    },
                    env: process.env as Record<string, string>
                };

                const executionResult: any = await TOOL_EXECUTORS[functionName](context);

                const dynamicCost = executionResult?.additionalCreditsUsed || 0;
                const totalCreditsToDeduct = flatCost > 0 ? flatCost : dynamicCost;

                if (totalCreditsToDeduct > 0) {
                    await recordUsageTransaction(userId, totalCreditsToDeduct, {
                        sessionId: context.sessionId,
                        sessionTitle: sessionAttrs.terminalTitle,
                        actionType: 'TOOL_EXECUTION',
                        toolName: functionName,
                    });
                }

                if (executionResult && executionResult.__END_CURRENT_EXECUTION__) {
                    responseText = executionResult.message || `Task scheduled successfully. Agent will go to sleep.`;
                } else {
                    responseText = `Execution Success: ${JSON.stringify(executionResult)}`;
                }

            } catch (err: any) {
                responseText = `Execution failed for ${functionName}: ${err.message}`;
            }

        } else {
            responseText = `Error: Unknown function requested - ${functionName}`;
        }

    } catch (error: any) {
        console.error(`System error for ${functionName}:`, error);
        responseText = `Error during execution: ${error.message}`;
    }

    return buildActionGroupResponse(actionGroup, functionName, responseText);
};

function buildActionGroupResponse(actionGroup: string, functionName: string, text: string) {
    return {
        messageVersion: "1.0",
        response: {
            actionGroup: actionGroup,
            function: functionName,
            functionResponse: { responseBody: { TEXT: { body: text } } }
        }
    };
}

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
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId: userId },
                        UpdateExpression: "SET computeCredits = computeCredits - :cost",
                        ExpressionAttributeValues: { ":cost": cost }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE,
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
        console.error(`CRITICAL: Transaction failed for user ${userId}. Executing direct credit deduction fallback.`, err);
        try {
            await dynamodb.send(new UpdateCommand({
                TableName: USER_PROFILES_TABLE,
                Key: { cognitoUserId: userId },
                UpdateExpression: "SET computeCredits = computeCredits - :cost",
                ExpressionAttributeValues: { ":cost": cost }
            }));
        } catch (fallbackErr) {
            console.error(`FATAL: Fallback credit deduction failed for user ${userId}:`, fallbackErr);
        }
    }
}