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

  console.log(`Executing UNCONDITIONAL PURGE & RESEED for table: ${tableName}`);

  try {
    let LastEvaluatedKey: Record<string, any> | undefined;
    let deletedCount = 0;

    do {
      const scanRes = await dynamodb.send(new ScanCommand({ 
        TableName: tableName,
        ExclusiveStartKey: LastEvaluatedKey
      }));

      if (scanRes.Items && scanRes.Items.length > 0) {
        const deletePromises = scanRes.Items.map(item => 
          dynamodb.send(new DeleteCommand({
            TableName: tableName,
            Key: { id: item.id }
          }))
        );
        await Promise.all(deletePromises);
        deletedCount += scanRes.Items.length;
      }
      LastEvaluatedKey = scanRes.LastEvaluatedKey;
    } while (LastEvaluatedKey);

    console.log(`Successfully purged ${deletedCount} ghost records from DynamoDB.`);

    const now = new Date().toISOString();
    
    const putPromises = SEED_MODELS.map(model => {
      const item = {
        id: model.apiIdentifier,
        __typename: 'FoundationModel',
        name: model.name,
        apiIdentifier: model.apiIdentifier,
        provider: model.provider,
        modality: model.modality,
        contextWindowTokens: model.contextWindowTokens,
        isActive: model.isActive,
        description: model.description,
        caliber: model.caliber,
        region: model.region,
        updatedBy: 'SYSTEM_SEEDER',
        createdAt: now,
        updatedAt: now,
      };

      return dynamodb.send(new PutCommand({
        TableName: tableName,
        Item: item,
      }));
    });

    await Promise.all(putPromises);
    console.log(`Seeding completed. Inserted ${SEED_MODELS.length} deduplicated models.`);
    
    return { status: "SUCCESS" };

  } catch (error: any) {
    console.error("Fatal failure during seeding process:", error);
    return { status: "FAILED", reason: error.message };
  }
};