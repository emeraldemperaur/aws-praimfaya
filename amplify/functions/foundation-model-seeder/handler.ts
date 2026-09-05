import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SEED_MODELS } from "./seed-data";

const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

export const handler = async (event: any) => {
  const tableName = process.env.FOUNDATION_MODELS_TABLE_NAME;

  if (!tableName) {
    console.error("FOUNDATION_MODELS_TABLE_NAME is not configured.");
    return { status: "FAILED", reason: "Missing table name" };
  }

  console.log(`Starting Smart Foundation Models seed for table: ${tableName}`);
  const now = new Date().toISOString();

  try {
    // 1. Fetch all existing records
    const existingItems: any[] = [];
    let LastEvaluatedKey: Record<string, any> | undefined;
    
    do {
      const scanRes = await dynamodb.send(new ScanCommand({ 
        TableName: tableName,
        ExclusiveStartKey: LastEvaluatedKey
      }));
      if (scanRes.Items) {
        existingItems.push(...scanRes.Items);
      }
      LastEvaluatedKey = scanRes.LastEvaluatedKey;
    } while (LastEvaluatedKey);

    // 2. Cleanup Phase: Delete legacy/duplicate items that are NOT in the SEED_MODELS list
    const validSeedIds = SEED_MODELS.map(m => m.apiIdentifier);
    const itemsToDelete = existingItems.filter(item => !validSeedIds.includes(item.id));
    
    if (itemsToDelete.length > 0) {
      console.log(`Cleaning up ${itemsToDelete.length} obsolete/duplicate models...`);
      for (const item of itemsToDelete) {
        await dynamodb.send(new DeleteCommand({
          TableName: tableName,
          Key: { id: item.id }
        }));
      }
    }

    for (const model of SEED_MODELS) {
      const deterministicId = model.apiIdentifier;
      const existingRecord = existingItems.find(i => i.id === deterministicId);
      const item = {
        id: deterministicId,
        __typename: 'FoundationModel',
        name: model.name,
        apiIdentifier: model.apiIdentifier,
        provider: model.provider,
        modality: model.modality,
        contextWindowTokens: model.contextWindowTokens,
        isActive: existingRecord && existingRecord.isActive !== undefined 
            ? existingRecord.isActive 
            : model.isActive,
            
        description: model.description,
        caliber: model.caliber,
        region: model.region,
        updatedBy: existingRecord ? existingRecord.updatedBy : 'SYSTEM_SEEDER',
        createdAt: existingRecord ? existingRecord.createdAt : now,
        updatedAt: now,
      };

      await dynamodb.send(new PutCommand({
        TableName: tableName,
        Item: item,
      }));
    }

    console.log(`Smart Seeding completed. Upserted ${SEED_MODELS.length} models.`);
    return { status: "SUCCESS" };

  } catch (error: any) {
    console.error("Failed during seeding process:", error);
    return { status: "FAILED", reason: error.message };
  }
};