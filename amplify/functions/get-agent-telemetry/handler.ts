import { 
  BedrockAgentClient, 
  GetAgentKnowledgeBaseCommand, 
  ListAgentActionGroupsCommand, 
  ListAgentVersionsCommand 
} from "@aws-sdk/client-bedrock-agent";
import type { AppSyncResolverHandler } from "aws-lambda";

const bedrock = new BedrockAgentClient({ region: process.env.AWS_REGION });

export const handler: AppSyncResolverHandler<{ agentId: string, aliasId: string }, any> = async (event) => {
  const { agentId, aliasId } = event.arguments;

  try {
    let kbHealth = "UNLINKED";
    try {
      const kbRes = await bedrock.send(new GetAgentKnowledgeBaseCommand({
        agentId,
        agentVersion: "DRAFT", 
        knowledgeBaseId: "ANY" 
      }));
      kbHealth = kbRes.agentKnowledgeBase?.knowledgeBaseState || "UNKNOWN";
    } catch (e) {
    }

    const actionGroupsRes = await bedrock.send(new ListAgentActionGroupsCommand({
      agentId,
      agentVersion: "DRAFT" 
    }));
    
    const activeTools = actionGroupsRes.actionGroupSummaries
      ?.filter(ag => ag.actionGroupState === "ENABLED")
      .map(ag => ag.actionGroupName) || [];

    const versionsRes = await bedrock.send(new ListAgentVersionsCommand({
      agentId
    }));
    
    const versionCount = versionsRes.agentVersionSummaries?.length || 1;

    return {
      statusCode: 200,
      data: JSON.stringify({
        knowledgeBaseStatus: kbHealth,
        activeTools: activeTools,
        totalDeployedVersions: versionCount
      })
    };

  } catch (error: any) {
    console.error("Failed to fetch Bedrock telemetry:", error);
    return { statusCode: 500, data: JSON.stringify({ error: error.message }) };
  }
};