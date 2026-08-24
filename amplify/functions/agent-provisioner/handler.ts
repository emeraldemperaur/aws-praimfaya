import { 
  BedrockAgentClient, CreateAgentCommand, AssociateAgentKnowledgeBaseCommand,
  CreateAgentActionGroupCommand, AssociateAgentCollaboratorCommand,
  PrepareAgentCommand, CreateAgentAliasCommand 
} from "@aws-sdk/client-bedrock-agent";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBStreamHandler } from "aws-lambda";

const bedrock = new BedrockAgentClient({ region: process.env.AWS_REGION });
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) continue;

      const profileId = newImage.id.S!;
      const role = newImage.role?.S;
      const status = newImage.provisioningStatus?.S;
      
      if (!role || role === 'STANDARD') continue;
      if (status !== 'PROVISIONING') {
        console.log(`Ignoring profile ${profileId}. Status is ${status}`);
        continue;
      }

      try {
        const workflows = await getAssignedWorkflows(profileId);
        let dynamicInstruction = newImage.systemPrompt?.S || '';
        
        if (workflows.length > 0) {
            dynamicInstruction += `\n\n### Available Automation Workflows ###\n`;
            dynamicInstruction += `You have access to external automation tools. To trigger one, invoke the 'ExecuteWorkflow' function using the exact Workflow ID and a valid JSON string for 'payloadJson'.\n`;
            
            for (const wf of workflows) {
               dynamicInstruction += `\n--- WORKFLOW: ${wf.name} ---\n`;
               dynamicInstruction += `ID: ${wf.id}\n`;
               dynamicInstruction += `Platform Tool: ${wf.tool || 'GENERIC'}\n`;
               dynamicInstruction += `Description: ${wf.description || 'No description provided'}\n`;
               
               if (wf.inputParameters && wf.inputParameters.length > 0) {
                   const inputs = wf.inputParameters
                       .map((p: any) => `${p.variable} [Type: ${p.type || 'String'}]${p.isRequired ? ' (REQUIRED)' : ' (Optional)'}`)
                       .join(', ');
                   dynamicInstruction += `Required Input JSON Keys: [${inputs}]\n`;
               } else {
                   dynamicInstruction += `Required Input JSON Keys: None (Pass an empty JSON object {})\n`;
               }

               if (wf.outputVariables && wf.outputVariables.length > 0) {
                   const outputs = wf.outputVariables
                       .map((p: any) => `${p.variable} [Type: ${p.type || 'String'}]`)
                       .join(', ');
                   dynamicInstruction += `Expected Response JSON Keys: [${outputs}]\n`;
               }
            }
        }

        const createAgentRes = await bedrock.send(new CreateAgentCommand({
          agentName: `ctx-profile-${profileId.substring(0, 8)}`,
          description: newImage.description?.S || 'Asimov Orchestrator',
          instruction: dynamicInstruction,
          foundationModel: newImage.llmModelId?.S!, 
          agentResourceRoleArn: process.env.BEDROCK_AGENT_ROLE_ARN!,
          idleSessionTTLInSeconds: 3600
        }));
        
        const agentId = createAgentRes.agent!.agentId!;

        if (newImage.vectorCollectionId?.S) {
          await bedrock.send(new AssociateAgentKnowledgeBaseCommand({
            agentId: agentId,
            agentVersion: "DRAFT",
            knowledgeBaseId: newImage.vectorCollectionId.S,
            description: "Primary multimodal vector store for enterprise context retrieval.",
            knowledgeBaseState: "ENABLED"
          }));
        }

        await bedrock.send(new CreateAgentActionGroupCommand({
          agentId: agentId,
          agentVersion: "DRAFT",
          actionGroupName: "DynamicAutomationRouter",
          actionGroupExecutor: { lambda: process.env.WEBHOOK_ROUTER_LAMBDA_ARN! },
          functionSchema: {
            functions: [{
              name: "ExecuteWorkflow",
              description: "Triggers an external automation webhook (Zapier, Make, n8n, Pipedream, etc.).",
              parameters: {
                "workflowId": {
                  type: "string",
                  description: "The unique ID of the workflow to trigger.",
                  required: true
                },
                "payloadJson": {
                  type: "string",
                  description: "A valid JSON string containing the exact input parameters required by the workflow.",
                  required: true
                }
              }
            }]
          }
        }));

        if (process.env.MULTIMEDIA_EXECUTOR_LAMBDA_ARN) {
          await bedrock.send(new CreateAgentActionGroupCommand({
            agentId: agentId,
            agentVersion: "DRAFT",
            actionGroupName: "MultimediaEngine",
            actionGroupExecutor: { lambda: process.env.MULTIMEDIA_EXECUTOR_LAMBDA_ARN! },
            functionSchema: {
              functions: [
                {
                  name: "generate_image",
                  description: "Generates high-fidelity images using Stability AI SD3.5 Large.",
                  parameters: { "prompt": { type: "string", description: "Detailed visual description of the image to generate.", required: true } }
                },
                {
                  name: "generate_enterprise_image",
                  description: "Generates enterprise/corporate images using Amazon Titan Image Generator v2.",
                  parameters: { "prompt": { type: "string", description: "Detailed visual description of the image.", required: true } }
                },
                {
                  name: "generate_audio",
                  description: "Converts text to spoken audio using Amazon Polly Generative Engine.",
                  parameters: {
                    "text": { type: "string", description: "The text to convert to speech.", required: true },
                    "voiceId": { type: "string", description: "Optional voice identifier.", required: false }
                  }
                },
                {
                  name: "generate_luma_video",
                  description: "Generates realistic video content using Luma Dream Machine.",
                  parameters: {
                    "prompt": { type: "string", description: "Detailed visual description of the video.", required: true },
                    "aspectRatio": { type: "string", description: "16:9, 9:16, or 1:1", required: false }
                  }
                }
              ]
            }
          }));
        }

        if (role === 'SUPERVISOR') {
          const collaborators = await getCollaborators(profileId);
          for (const collab of collaborators) {
            if (collab.awsAgentId && collab.awsAliasId) {
              const eavesdropSetting = collab.subagentEavesdrop ? "TO_COLLABORATOR" : "DISABLED";
              await bedrock.send(new AssociateAgentCollaboratorCommand({
                agentId: agentId,
                agentVersion: "DRAFT",
                collaboratorName: collab.name.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 32),
                collaborationInstruction: collab.description,
                relayConversationHistory: eavesdropSetting,
                agentDescriptor: { aliasArn: `arn:aws:bedrock:${process.env.AWS_REGION}:${process.env.ACCOUNT_ID}:agent-alias/${collab.awsAgentId}/${collab.awsAliasId}` }
              }));
            }
          }
        }

        await bedrock.send(new PrepareAgentCommand({ agentId }));
        
        const aliasRes = await bedrock.send(new CreateAgentAliasCommand({
          agentId: agentId,
          agentAliasName: "v1-prod"
        }));

        await updateDatabaseStatus(profileId, 'READY', agentId, aliasRes.agentAlias!.agentAliasId!);

      } catch (error) {
        console.error(`Provisioning failed for ${profileId}`, error);
        await updateDatabaseStatus(profileId, 'FAILED');
      }
    }
  }
};

async function getAssignedWorkflows(profileId: string) {
    const mappingRes = await dynamodb.send(new QueryCommand({
        TableName: process.env.PROFILE_WORKFLOWS_TABLE_NAME!,
        IndexName: 'byProfile',
        KeyConditionExpression: 'contextProfileId = :pid',
        ExpressionAttributeValues: { ':pid': profileId }
    }));
    
    const workflowIds = mappingRes.Items?.map(item => item.contextWorkflowId) || [];
    const workflows = [];
    
    for (const wId of workflowIds) {
        const wfRes = await dynamodb.send(new GetCommand({
            TableName: process.env.WORKFLOWS_TABLE_NAME!,
            Key: { id: wId }
        }));
        if (wfRes.Item && !wfRes.Item.archived) workflows.push(wfRes.Item);
    }
    return workflows;
}

async function getCollaborators(supervisorId: string) {
  const res = await dynamodb.send(new QueryCommand({
    TableName: process.env.PROFILES_TABLE_NAME!,
    IndexName: 'bySupervisor',
    KeyConditionExpression: 'supervisorId = :sid',
    ExpressionAttributeValues: { ':sid': supervisorId }
  }));
  return res.Items || [];
}

async function updateDatabaseStatus(id: string, status: string, agentId?: string, aliasId?: string) {
  let updateExpr = "set provisioningStatus = :s";
  let exprValues: any = { ":s": status };

  if (agentId && aliasId) {
    updateExpr += ", awsAgentId = :ag, awsAliasId = :al";
    exprValues[":ag"] = agentId;
    exprValues[":al"] = aliasId;
  }

  await dynamodb.send(new UpdateCommand({
    TableName: process.env.PROFILES_TABLE_NAME!,
    Key: { id },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: exprValues
  }));
}