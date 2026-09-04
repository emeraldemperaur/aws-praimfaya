import { BedrockAgentClient, StartIngestionJobCommand, ListKnowledgeBasesCommand, ListDataSourcesCommand } from "@aws-sdk/client-bedrock-agent";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const bedrockClient = new BedrockAgentClient({ region: process.env.AWS_REGION });
const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const DEFAULT_NOMINAL_SYNC_COST = 1000; 

export const handler = async (event: any) => {
    const { collectionId, syncCost } = event.arguments || {};
    
    const cognitoUserId = event.identity?.claims?.sub || event.identity?.username;

    if (!cognitoUserId) {
        return JSON.stringify({ error: "Unauthorized. User identity not found." });
    }

    const actualSyncCost = typeof syncCost === 'number' && syncCost > 0 ? syncCost : DEFAULT_NOMINAL_SYNC_COST;
    const recordId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    try {
   
        const userRes = await dynamodb.send(new GetCommand({ 
            TableName: USER_PROFILES_TABLE, 
            Key: { cognitoUserId } 
        }));
        
        const computeCredits = userRes.Item?.computeCredits ?? 0;
        
        if (computeCredits < actualSyncCost) {
            return JSON.stringify({ 
                error: `INSUFFICIENT_CREDITS: Vector database synchronization requires ${actualSyncCost.toLocaleString()} credits. You only have ${computeCredits.toLocaleString()} available.` 
            });
        }

        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId },
                        UpdateExpression: "SET computeCredits = computeCredits - :cost",
                        ExpressionAttributeValues: { ":cost": actualSyncCost },
                        ConditionExpression: "computeCredits >= :cost"
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE, 
                        Item: {
                            id: recordId,
                            userId: cognitoUserId,
                            sessionId: `sync-${collectionId}`,
                            sessionTitle: 'Vector DB Synchronization',
                            actionType: 'TOOL_EXECUTION',
                            toolName: 'S3VectorIngestion',
                            creditsUsed: actualSyncCost,
                            createdAt: now
                        }
                    }
                }
            ]
        }));

       
        const kbResponse = await bedrockClient.send(new ListKnowledgeBasesCommand({ maxResults: 10 }));
        
        const targetKbs = [
            { kb: 'TitanTextKB', ds: 'TitanTextDataSource' },
            { kb: 'NovaMediaKB', ds: 'NovaMediaDataSource' }
        ];

        let successfulSyncs = 0;
        let lastError = "";

        for (const target of targetKbs) {
            try {
                const kb = kbResponse.knowledgeBaseSummaries?.find(k => k.name === target.kb);
                if (!kb?.knowledgeBaseId) continue;

                const dsResponse = await bedrockClient.send(new ListDataSourcesCommand({ knowledgeBaseId: kb.knowledgeBaseId }));
                const ds = dsResponse.dataSourceSummaries?.find(d => d.name === target.ds);
                if (!ds?.dataSourceId) continue;

                await bedrockClient.send(new StartIngestionJobCommand({
                    knowledgeBaseId: kb.knowledgeBaseId,
                    dataSourceId: ds.dataSourceId,
                    description: `Batch sync triggered by UI for collection: ${collectionId}`
                }));
                
                successfulSyncs++;

            } catch (err: any) {
                if (err.name === 'ConflictException') {
                    console.log(`Ingestion job already running for ${target.kb}.`);
                    successfulSyncs++; 
                } else {
                    console.error(`Failed to start job for ${target.kb}:`, err);
                    lastError = err.message;
                }
            }
        }

        
        if (successfulSyncs === 0) {
            console.warn(`All Bedrock syncs failed. Refunding ${actualSyncCost} credits to user ${cognitoUserId}.`);
            
            await dynamodb.send(new UpdateCommand({
                TableName: USER_PROFILES_TABLE,
                Key: { cognitoUserId },
                UpdateExpression: "SET computeCredits = computeCredits + :refund",
                ExpressionAttributeValues: { ":refund": actualSyncCost }
            }));
            
            await dynamodb.send(new DeleteCommand({
                TableName: USAGE_RECORDS_TABLE,
                Key: { id: recordId }
            }));

            return JSON.stringify({ error: `Sync failed due to AWS Bedrock error: ${lastError}` });
        }

        return JSON.stringify({ status: "Sync Initiated successfully." });

    } catch (error: any) {
        console.error("Sync Error:", error);
        
        if (error.name === 'TransactionCanceledException') {
            return JSON.stringify({ error: "Transaction failed. Please check your compute credit balance." });
        }
        
        return JSON.stringify({ error: error.message });
    }
};