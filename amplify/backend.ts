import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { vectorCollectionsS3, ragArtifactsS3 } from './storage/resource';
import { processVector } from './functions/process-vector/resource';
import { updateVectorStatus } from './functions/update-vector-status/resource';
import { agentProvisioner } from './functions/agent-provisioner/resource';
import { webhookRouter } from './functions/webhook-router/resource';
import { agentReaper } from './functions/agent-smith/resource';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda'; 
import { RemovalPolicy } from 'aws-cdk-lib';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { chatHandler } from './functions/chat-handler/resource';

const backend = defineBackend({
  auth,
  data,
  vectorCollectionsS3,
  ragArtifactsS3,
  processVector,
  updateVectorStatus,
  agentProvisioner,
  webhookRouter,
  agentReaper,
  chatHandler
});

const customStack = backend.createStack('BedrockAIStack');

// =================================================================================
// KNOWLEDGE BASE & VECTOR DB INFRASTRUCTURE
// =================================================================================

const vectorBucket = new s3vectors.CfnVectorBucket(customStack, 'CentralVectorBucket', {});

const titanIndex = new s3vectors.CfnIndex(customStack, 'TitanTextIndex', {
  vectorBucketArn: vectorBucket.attrVectorBucketArn,
  dimension: 1024, 
  distanceMetric: 'cosine', 
  dataType: 'float32',
  metadataConfiguration: {
    nonFilterableMetadataKeys: ['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA', 'x-amz-bedrock-kb-source-uri', 'x-amz-bedrock-kb-chunk-id', 'x-amz-bedrock-kb-data-source-id']
  }
});

const novaIndex = new s3vectors.CfnIndex(customStack, 'NovaMediaIndex', {
  vectorBucketArn: vectorBucket.attrVectorBucketArn,
  dimension: 3072, 
  distanceMetric: 'cosine', 
  dataType: 'float32',
  metadataConfiguration: {
    nonFilterableMetadataKeys: ['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA', 'x-amz-bedrock-kb-source-uri', 'x-amz-bedrock-kb-chunk-id', 'x-amz-bedrock-kb-data-source-id']
  }
});

const multimodalBucket = new s3.Bucket(customStack, 'MultimodalStorageBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.DESTROY, 
  autoDeleteObjects: true,
});

const bedrockKbRole = new iam.Role(customStack, 'BedrockKBRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

const bedrockKbPolicy = new iam.Policy(customStack, 'BedrockKBPolicy', {
  statements: [
    new iam.PolicyStatement({
      actions: ['s3vectors:QueryVectors', 's3vectors:PutVectors', 's3vectors:DeleteVectors', 's3vectors:GetVectors', 's3vectors:GetVectorBucket', 's3vectors:ListIndexes'],
      resources: [vectorBucket.attrVectorBucketArn, titanIndex.attrIndexArn, novaIndex.attrIndexArn, `${vectorBucket.attrVectorBucketArn}/*`]
    }),
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.titan-embed-text-v2:0`,
        `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`
      ],
    }),
    new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject', 's3:DeleteObject'],
      resources: [
        backend.vectorCollectionsS3.resources.bucket.bucketArn,
        `${backend.vectorCollectionsS3.resources.bucket.bucketArn}/*`,
        multimodalBucket.bucketArn,
        `${multimodalBucket.bucketArn}/*`
      ]
    })
  ]
});
bedrockKbRole.attachInlinePolicy(bedrockKbPolicy);

const titanKb = new bedrock.CfnKnowledgeBase(customStack, 'TitanTextKB', {
  name: 'TitanTextKB',
  roleArn: bedrockKbRole.roleArn,
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: { embeddingModelArn: `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.titan-embed-text-v2:0` }
  },
  storageConfiguration: {
    type: 'S3_VECTORS',
    s3VectorsConfiguration: {
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
      indexName: titanIndex.indexName!, 
      indexArn: titanIndex.attrIndexArn,
    }
  }
});
titanKb.node.addDependency(titanIndex);
titanKb.node.addDependency(bedrockKbPolicy);

new bedrock.CfnDataSource(customStack, 'TitanTextDataSource', {
  knowledgeBaseId: titanKb.ref,
  name: 'TitanTextDataSource',
  dataSourceConfiguration: {
    type: 'S3',
    s3Configuration: {
      bucketArn: backend.vectorCollectionsS3.resources.bucket.bucketArn,
      inclusionPrefixes: ['vector-collections/text/'] 
    }
  },
  vectorIngestionConfiguration: {
    chunkingConfiguration: { 
      chunkingStrategy: 'HIERARCHICAL',
      hierarchicalChunkingConfiguration: {
        levelConfigurations: [{ maxTokens: 1500 }, { maxTokens: 300 }],
        overlapTokens: 60      
      }
    }
  }
});

const novaKbCr = new cr.AwsCustomResource(customStack, 'NovaMediaKBCR', {
  onCreate: {
    service: 'BedrockAgent',
    action: 'CreateKnowledgeBaseCommand',
    parameters: {
      name: 'NovaMediaKB',
      roleArn: bedrockKbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`,
          supplementalDataStorageConfiguration: {
            storageLocations: [{ type: 'S3', s3Location: { uri: `s3://${multimodalBucket.bucketName}/` } }]
          }
        }
      },
      storageConfiguration: {
        type: 'S3_VECTORS',
        s3VectorsConfiguration: {
          vectorBucketArn: vectorBucket.attrVectorBucketArn,
          indexName: novaIndex.indexName!,
          indexArn: novaIndex.attrIndexArn,
        }
      }
    },
    physicalResourceId: cr.PhysicalResourceId.fromResponse('knowledgeBase.knowledgeBaseId'),
  },
  onDelete: {
    service: 'BedrockAgent',
    action: 'DeleteKnowledgeBaseCommand',
    parameters: { knowledgeBaseId: new cr.PhysicalResourceIdReference() }
  },
  policy: cr.AwsCustomResourcePolicy.fromStatements([
    new iam.PolicyStatement({ actions: ['bedrock:CreateKnowledgeBase', 'bedrock:DeleteKnowledgeBase'], resources: ['*'] }),
    new iam.PolicyStatement({ actions: ['iam:PassRole'], resources: [bedrockKbRole.roleArn] })
  ]),
});
novaKbCr.node.addDependency(novaIndex);
novaKbCr.node.addDependency(multimodalBucket);
novaKbCr.node.addDependency(bedrockKbPolicy);

new bedrock.CfnDataSource(customStack, 'NovaMediaDataSource', {
  knowledgeBaseId: novaKbCr.getResponseField('knowledgeBase.knowledgeBaseId'),
  name: 'NovaMediaDataSource',
  dataSourceConfiguration: {
    type: 'S3',
    s3Configuration: {
      bucketArn: backend.vectorCollectionsS3.resources.bucket.bucketArn,
      inclusionPrefixes: ['vector-collections/media/'] 
    }
  }
});

const processVectorLambda = backend.processVector.resources.lambda as lambda.Function;

backend.vectorCollectionsS3.resources.bucket.grantReadWrite(processVectorLambda);

processVectorLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'bedrock:ListKnowledgeBases',
    'bedrock:ListDataSources',
    'bedrock:StartIngestionJob'
  ],
  resources: ['*'] 
}));

backend.vectorCollectionsS3.resources.bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processVectorLambda),
  { prefix: 'vector-collections/' }
);

const statusLambda = backend.updateVectorStatus.resources.lambda as lambda.Function;

const bedrockEventRule = new events.Rule(customStack, 'BedrockIngestionStatusRule', {
  eventPattern: {
    source: ['aws.bedrock'],
    detailType: ['Bedrock Knowledge Base Ingestion Job State Change'],
  },
});

bedrockEventRule.addTarget(new targets.LambdaFunction(statusLambda));


// =================================================================================
// MULTI-AGENT PROVISIONING & WEBHOOK ROUTING
// =================================================================================

// Casting to lambda.Function exposes the .addEnvironment() method required below
const provisionerLambda = backend.agentProvisioner.resources.lambda as lambda.Function;
const routerLambda = backend.webhookRouter.resources.lambda as lambda.Function;
const reaperLambda = backend.agentReaper.resources.lambda as lambda.Function;

const profilesTable = backend.data.resources.tables["ContextProfile"];
const workflowsTable = backend.data.resources.tables["ContextWorkflow"];
const profileWorkflowsTable = backend.data.resources.tables["ContextProfileWorkflow"];

provisionerLambda.addEventSource(new DynamoEventSource(profilesTable, {
  startingPosition: lambda.StartingPosition.LATEST,
  batchSize: 1, 
  retryAttempts: 3
}));

provisionerLambda.addEnvironment('PROFILES_TABLE_NAME', profilesTable.tableName);
provisionerLambda.addEnvironment('WORKFLOWS_TABLE_NAME', workflowsTable.tableName);
provisionerLambda.addEnvironment('PROFILE_WORKFLOWS_TABLE_NAME', profileWorkflowsTable.tableName);
provisionerLambda.addEnvironment('WEBHOOK_ROUTER_LAMBDA_ARN', routerLambda.functionArn);
provisionerLambda.addEnvironment('ACCOUNT_ID', customStack.account);

routerLambda.addEnvironment('WORKFLOWS_TABLE_NAME', workflowsTable.tableName);
reaperLambda.addEnvironment('PROFILES_TABLE_NAME', profilesTable.tableName);

profilesTable.grantReadWriteData(provisionerLambda);
profilesTable.grantReadWriteData(reaperLambda);
workflowsTable.grantReadData(provisionerLambda);
profileWorkflowsTable.grantReadData(provisionerLambda);
workflowsTable.grantReadData(routerLambda);

const bedrockAgentRole = new iam.Role(customStack, 'BedrockAgentExecutionRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
  ]
});
provisionerLambda.addEnvironment('BEDROCK_AGENT_ROLE_ARN', bedrockAgentRole.roleArn);

const bedrockAdminPolicy = new iam.PolicyStatement({
  actions: [
    "bedrock:CreateAgent",
    "bedrock:UpdateAgent",
    "bedrock:DeleteAgent",
    "bedrock:CreateAgentActionGroup",
    "bedrock:AssociateAgentKnowledgeBase",
    "bedrock:AssociateAgentCollaborator",
    "bedrock:PrepareAgent",
    "bedrock:CreateAgentAlias",
    "iam:PassRole" 
  ],
  resources: ["*"], 
});

provisionerLambda.addToRolePolicy(bedrockAdminPolicy);
reaperLambda.addToRolePolicy(bedrockAdminPolicy);

routerLambda.addPermission('AllowBedrockInvoke', {
  principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
});

const chatLambda = backend.chatHandler.resources.lambda as lambda.Function;

chatLambda.addEnvironment('PROFILES_TABLE_NAME', profilesTable.tableName);
chatLambda.addEnvironment('WORKFLOWS_TABLE_NAME', workflowsTable.tableName);
chatLambda.addEnvironment('PROFILE_WORKFLOWS_TABLE_NAME', profileWorkflowsTable.tableName);
chatLambda.addEnvironment('WEBHOOK_ROUTER_LAMBDA_ARN', routerLambda.functionArn);

profilesTable.grantReadData(chatLambda);
workflowsTable.grantReadData(chatLambda);
profileWorkflowsTable.grantReadData(chatLambda);

routerLambda.grantInvoke(chatLambda);

chatLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'bedrock:InvokeModel',
    'bedrock:InvokeModelWithResponseStream',
    'bedrock:Retrieve'
  ],
  resources: ['*']
}));