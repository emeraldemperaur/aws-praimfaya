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

  console.log(`Starting Foundation Models seed for table: ${tableName}`);
  const now = new Date().toISOString();

  try {
    const existingData = await dynamodb.send(new ScanCommand({ TableName: tableName }));
    
    if (existingData.Items && existingData.Items.length > 0) {
      console.log(`Clearing ${existingData.Items.length} existing records to prevent duplicates...`);
      for (const item of existingData.Items) {
        await dynamodb.send(new DeleteCommand({
          TableName: tableName,
          Key: { id: item.id }
        }));
      }
    }

    for (const model of SEED_MODELS) {
      const deterministicId = `fm_${model.apiIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      const item = {
        id: deterministicId,
        __typename: 'FoundationModel',
        name: model.name,
        apiIdentifier: model.apiIdentifier,
        provider: model.provider,
        modality: model.modality,
        contextWindowTokens: model.contextWindowTokens,
        isActive: model.isActive,
        description: model.description,
        calibre: model.caliber,
        region: model.region,
        updatedBy: 'SYSTEM_SEEDER',
        createdAt: now,
        updatedAt: now,
      };

      await dynamodb.send(new PutCommand({
        TableName: tableName,
        Item: item,
      }));
    }

    console.log("Foundation Models seeding completed successfully.");
    return { status: "SUCCESS" };

  } catch (error: any) {
    console.error("Failed during seeding process:", error);
    return { status: "FAILED", reason: error.message };
  }
};