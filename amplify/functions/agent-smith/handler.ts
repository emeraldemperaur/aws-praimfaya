import { BedrockAgentClient, DeleteAgentCommand } from "@aws-sdk/client-bedrock-agent";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { EventBridgeHandler } from "aws-lambda";

const bedrock = new BedrockAgentClient({ region: process.env.AWS_REGION });
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.PROFILES_TABLE_NAME!;

export const handler: EventBridgeHandler<"Scheduled Event", any, any> = async () => {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7);
  const isoThreshold = staleThreshold.toISOString();

  const res = await dynamodb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "provisioningStatus = :ready AND (attribute_not_exists(lastUsedAt) OR lastUsedAt < :thresh)",
    ExpressionAttributeValues: {
      ":ready": "READY",
      ":thresh": isoThreshold
    }
  }));

  const staleProfiles = res.Items || [];

  for (const profile of staleProfiles) {
    if (!profile.awsAgentId) continue;

    try {
      await bedrock.send(new DeleteAgentCommand({
        agentId: profile.awsAgentId,
        skipResourceInUseCheck: true
      }));

      await dynamodb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: profile.id },
        UpdateExpression: "set provisioningStatus = :unprov REMOVE awsAgentId, awsAliasId",
        ExpressionAttributeValues: { ":unprov": "UNPROVISIONED" }
      }));

      console.log(`Successfully reaped stale agent: ${profile.name} (${profile.awsAgentId})`);
    } catch (err) {
      console.error(`Failed to reap agent ${profile.awsAgentId}`, err);
    }
  }

  return { statusCode: 200, body: `Reaper completed. Cleaned up ${staleProfiles.length} agents.` };
};