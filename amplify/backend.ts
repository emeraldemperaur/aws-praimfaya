import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { vectorCollectionsS3, ragArtifactsS3 } from './storage/resource';
import { processVector } from './functions/process-vector/resource';
import { updateVectorStatus } from './functions/update-vector-status/resource';
import { agentProvisioner } from './functions/agent-provisioner/resource';
import { webhookRouter } from './functions/webhook-router/resource';
import { agentReaper } from './functions/agent-smith/resource';
import { chatHandler } from './functions/chat-handler/resource';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda'; 
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import { DynamoEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCheckoutSession } from './functions/stripe-checkout/resource';
import { grantPromoCredits } from './functions/admin-promo/resource';
import { stripeWebhook } from './functions/stripe-webhook/resource';
import { multimediaExecutor } from './functions/multimedia-executor/resource';
import { lexFulfillment } from './functions/lex-fulfillment/resource';
import { postCallAnalysis } from './functions/post-call-analysis/resource';
import { foundationModelSeeder } from './functions/foundation-model-seeder/resource';
import { syncKnowledgeBase } from './functions/sync-kyb/resource';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  chatHandler,
  createCheckoutSession,
  grantPromoCredits,
  stripeWebhook,
  multimediaExecutor,
  lexFulfillment,
  postCallAnalysis,
  foundationModelSeeder,
  syncKnowledgeBase 
});

const customStack = backend.createStack('BedrockAIStack');
// ADDED: Glue stack to break the circular dependency between data Lambdas and Bedrock events
const glueStack = backend.createStack('EventRoutingStack');

const isProd = cdk.Stage.of(customStack)?.stageName === 'prod';
const connectInstanceId = process.env.CONNECT_INSTANCE_ID || '';
const connectContactFlowId = process.env.CONNECT_CONTACT_FLOW_ID || '';
const connectSourcePhone = process.env.CONNECT_SOURCE_PHONE_NUMBER || '';

// DynamoDB Tables
const profilesTable = backend.data.resources.tables["ContextProfile"];
const workflowsTable = backend.data.resources.tables["ContextWorkflow"];
const profileWorkflowsTable = backend.data.resources.tables["ContextProfileWorkflow"];
const userProfilesTable = backend.data.resources.tables["UserProfile"];
const ragArtifactsTable = backend.data.resources.tables["RAGArtifact"];
const usageRecordsTable = backend.data.resources.tables["UsageRecord"];
const foundationModelsTable = backend.data.resources.tables["FoundationModel"];

// Serverless Lambdas
const processVectorLambda = backend.processVector.resources.lambda as lambda.Function;
const statusLambda = backend.updateVectorStatus.resources.lambda as lambda.Function;
const provisionerLambda = backend.agentProvisioner.resources.lambda as lambda.Function;
const routerLambda = backend.webhookRouter.resources.lambda as lambda.Function;
const reaperLambda = backend.agentReaper.resources.lambda as lambda.Function;
const chatLambda = backend.chatHandler.resources.lambda as lambda.Function;
const mediaLambda = backend.multimediaExecutor.resources.lambda as lambda.Function;
const checkoutLambda = backend.createCheckoutSession.resources.lambda as lambda.Function;
const webhookLambda = backend.stripeWebhook.resources.lambda as lambda.Function;
const promoLambda = backend.grantPromoCredits.resources.lambda as lambda.Function;
const lexFulfillmentLambda = backend.lexFulfillment.resources.lambda as lambda.Function;
const postCallAnalysisLambda = backend.postCallAnalysis.resources.lambda as lambda.Function;
const seederLambda = backend.foundationModelSeeder.resources.lambda as lambda.Function;
const syncKbLambda = backend.syncKnowledgeBase.resources.lambda as lambda.Function;

const streamDlq = new sqs.Queue(customStack, 'DynamoStreamDLQ', {
  retentionPeriod: Duration.days(14),
  encryption: sqs.QueueEncryption.SQS_MANAGED
});

const multimodalBucket = new s3.Bucket(customStack, 'MultimodalStorageBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY, 
  autoDeleteObjects: !isProd,
});

const airflowDagsBucket = new s3.Bucket(customStack, 'AirflowDagsBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  versioned: true, 
  removalPolicy: RemovalPolicy.RETAIN,
});

// Vector DB Infrastructure
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

// Knowledge Base Configurations
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

backend.vectorCollectionsS3.resources.bucket.grantReadWrite(processVectorLambda);

backend.vectorCollectionsS3.resources.bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processVectorLambda),
  { prefix: 'vector-collections/' }
);

syncKbLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:ListKnowledgeBases', 'bedrock:ListDataSources', 'bedrock:StartIngestionJob'],
  resources: ['*'] 
}));

syncKbLambda.addEnvironment('USER_PROFILES_TABLE_NAME', userProfilesTable.tableName);
syncKbLambda.addEnvironment('USAGE_RECORDS_TABLE_NAME', usageRecordsTable.tableName);
userProfilesTable.grantReadWriteData(syncKbLambda);
usageRecordsTable.grantReadWriteData(syncKbLambda);

// UPDATED: Assigned to glueStack
const bedrockEventRule = new events.Rule(glueStack, 'BedrockIngestionStatusRule', {
  eventPattern: {
    source: ['aws.bedrock'],
    detailType: ['Bedrock Knowledge Base Ingestion Job State Change'],
  },
});
bedrockEventRule.addTarget(new targets.LambdaFunction(statusLambda));

provisionerLambda.addEventSource(new DynamoEventSource(profilesTable, {
  startingPosition: lambda.StartingPosition.LATEST,
  batchSize: 1, 
  retryAttempts: 3,
  onFailure: new SqsDlq(streamDlq)
}));

provisionerLambda.addEnvironment('PROFILES_TABLE_NAME', profilesTable.tableName);
provisionerLambda.addEnvironment('WORKFLOWS_TABLE_NAME', workflowsTable.tableName);
provisionerLambda.addEnvironment('PROFILE_WORKFLOWS_TABLE_NAME', profileWorkflowsTable.tableName);
provisionerLambda.addEnvironment('WEBHOOK_ROUTER_LAMBDA_ARN', routerLambda.functionArn);
provisionerLambda.addEnvironment('MULTIMEDIA_EXECUTOR_LAMBDA_ARN', mediaLambda.functionArn);
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
  managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')]
});
provisionerLambda.addEnvironment('BEDROCK_AGENT_ROLE_ARN', bedrockAgentRole.roleArn);

const bedrockAdminPolicy = new iam.PolicyStatement({
  actions: [
    "bedrock:CreateAgent", "bedrock:UpdateAgent", "bedrock:DeleteAgent",
    "bedrock:CreateAgentActionGroup", "bedrock:AssociateAgentKnowledgeBase",
    "bedrock:AssociateAgentCollaborator", "bedrock:PrepareAgent",
    "bedrock:CreateAgentAlias", "iam:PassRole" 
  ],
  resources: ["*"], 
});

provisionerLambda.addToRolePolicy(bedrockAdminPolicy);
reaperLambda.addToRolePolicy(bedrockAdminPolicy);

routerLambda.addPermission('AllowBedrockInvoke', {
  principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
});

// Chat Lambda & Vector Tools Configuration
chatLambda.addEnvironment('PROFILES_TABLE_NAME', profilesTable.tableName);
chatLambda.addEnvironment('WORKFLOWS_TABLE_NAME', workflowsTable.tableName);
chatLambda.addEnvironment('PROFILE_WORKFLOWS_TABLE_NAME', profileWorkflowsTable.tableName);
chatLambda.addEnvironment('WEBHOOK_ROUTER_LAMBDA_ARN', routerLambda.functionArn);
chatLambda.addEnvironment('YARDI_MCP_URL', process.env.YARDI_MCP_URL || 'https://virtuoso.yardi.com/mcp');
chatLambda.addEnvironment('MITO_MCP_URL', process.env.MITO_MCP_URL || 'http://mito-ui.com/mcp');
chatLambda.addEnvironment('APOTHEOSIS_MCP_URL', process.env.APOTHEOSIS_MCP_URL || 'https://apotheosis-ux.com/mcp');
chatLambda.addEnvironment('USER_PROFILES_TABLE_NAME', userProfilesTable.tableName);
chatLambda.addEnvironment('RAG_ARTIFACTS_TABLE_NAME', ragArtifactsTable.tableName);
chatLambda.addEnvironment('USAGE_RECORDS_TABLE_NAME', usageRecordsTable.tableName);
chatLambda.addEnvironment('MEDIA_OUTPUT_BUCKET_NAME', multimodalBucket.bucketName);
chatLambda.addEnvironment('TITAN_TEXT_KB_ID', titanKb.ref);

profilesTable.grantReadData(chatLambda);
workflowsTable.grantReadData(chatLambda);
profileWorkflowsTable.grantReadData(chatLambda);
userProfilesTable.grantReadWriteData(chatLambda);
ragArtifactsTable.grantReadWriteData(chatLambda);
usageRecordsTable.grantReadWriteData(chatLambda);
multimodalBucket.grantReadWrite(chatLambda);
routerLambda.grantInvoke(chatLambda);

chatLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream', 'bedrock:StartAsyncInvoke', 'bedrock:Retrieve', 'polly:SynthesizeSpeech'],
  resources: ['*']
}));

const dagValidatorLambda = new lambda.Function(customStack, 'DagValidatorFunction', {
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: 'handler.lambda_handler',
  code: lambda.Code.fromAsset(join(__dirname, 'functions', 'dag-validator')),
  timeout: Duration.seconds(10),
  memorySize: 128,
});

chatLambda.addEnvironment('PYTHON_VALIDATOR_LAMBDA_ARN', dagValidatorLambda.functionArn);
dagValidatorLambda.grantInvoke(chatLambda);
chatLambda.addEnvironment('AIRFLOW_DAGS_BUCKET', airflowDagsBucket.bucketName);
airflowDagsBucket.grantWrite(chatLambda);

// Multimedia Executor Configuration
mediaLambda.addEnvironment('MEDIA_OUTPUT_BUCKET_NAME', multimodalBucket.bucketName);
mediaLambda.addEnvironment('RAG_ARTIFACTS_TABLE_NAME', ragArtifactsTable.tableName);
mediaLambda.addEnvironment('USER_PROFILES_TABLE_NAME', userProfilesTable.tableName);
mediaLambda.addEnvironment('USAGE_RECORDS_TABLE_NAME', usageRecordsTable.tableName);

multimodalBucket.grantReadWrite(mediaLambda);
ragArtifactsTable.grantReadWriteData(mediaLambda);
userProfilesTable.grantReadWriteData(mediaLambda);
usageRecordsTable.grantReadWriteData(mediaLambda);

mediaLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel', 'bedrock:StartAsyncInvoke', 'polly:SynthesizeSpeech'],
  resources: ['*']
}));

mediaLambda.addPermission('AllowBedrockAgentInvoke', {
  principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
});

// Billing Configuration
checkoutLambda.addEnvironment('VANGUARD_PRICE_ID', process.env.VANGUARD_PRICE_ID || 'price_1UB4nDI2Coxc9y6EopiOCY2v');
checkoutLambda.addEnvironment('VANGUARD_ELITE_PRICE_ID', process.env.VANGUARD_ELITE_PRICE_ID || 'price_1UB4ppI2Coxc9y6ESB2H7uIS');
checkoutLambda.addEnvironment('TOP_UP_PRICE_ID', process.env.TOP_UP_PRICE_ID || 'price_1UB56mI2Coxc9y6Ejo4sGyve');
checkoutLambda.addEnvironment('FRONTEND_URL', process.env.FRONTEND_URL || 'http://localhost:5173');
webhookLambda.addEnvironment('VANGUARD_PRICE_ID', process.env.VANGUARD_PRICE_ID || 'price_1UB4ppI2Coxc9y6ESB2H7uIS');
webhookLambda.addEnvironment('VANGUARD_ELITE_PRICE_ID', process.env.VANGUARD_ELITE_PRICE_ID || 'price_1UB4ppI2Coxc9y6ESB2H7uIS');
webhookLambda.addEnvironment('TOP_UP_PRICE_ID', process.env.TOP_UP_PRICE_ID || 'price_1UB56mI2Coxc9y6Ejo4sGyve');
webhookLambda.addEnvironment('USER_PROFILES_TABLE_NAME', userProfilesTable.tableName);
webhookLambda.addEnvironment('USAGE_RECORDS_TABLE_NAME', usageRecordsTable.tableName);
seederLambda.addEnvironment('FOUNDATION_MODELS_TABLE_NAME', foundationModelsTable.tableName);

userProfilesTable.grantReadWriteData(webhookLambda);
usageRecordsTable.grantReadWriteData(webhookLambda);
foundationModelsTable.grantReadWriteData(seederLambda);

const webhookUrl = webhookLambda.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
});

new cdk.CfnOutput(customStack, 'StripeWebhookUrl', {
  value: webhookUrl.url,
  description: 'Copy this URL and paste it into the Stripe Webhook Dashboard',
});

promoLambda.addEnvironment('USER_PROFILES_TABLE_NAME', userProfilesTable.tableName);
promoLambda.addEnvironment('USAGE_RECORDS_TABLE_NAME', usageRecordsTable.tableName);

userProfilesTable.grantReadWriteData(promoLambda);
usageRecordsTable.grantReadWriteData(promoLambda);

// Voice Agent Infrastructure
const voiceAgentTable = new dynamodb.Table(customStack, 'VoiceAgentCallLogs', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
});

lexFulfillmentLambda.addEnvironment('VOICE_AGENT_TRACKING_TABLE', voiceAgentTable.tableName);
postCallAnalysisLambda.addEnvironment('VOICE_AGENT_TRACKING_TABLE', voiceAgentTable.tableName);
chatLambda.addEnvironment('VOICE_AGENT_TRACKING_TABLE', voiceAgentTable.tableName);

chatLambda.addEnvironment('CONNECT_INSTANCE_ID', connectInstanceId);
chatLambda.addEnvironment('CONNECT_CONTACT_FLOW_ID', connectContactFlowId);
chatLambda.addEnvironment('CONNECT_SOURCE_PHONE_NUMBER', connectSourcePhone);
postCallAnalysisLambda.addEnvironment('USER_PROFILES_TABLE_NAME', userProfilesTable.tableName);
postCallAnalysisLambda.addEnvironment('USAGE_RECORDS_TABLE_NAME', usageRecordsTable.tableName);
mediaLambda.addEnvironment('VOICE_AGENT_TRACKING_TABLE', voiceAgentTable.tableName);
mediaLambda.addEnvironment('CONNECT_INSTANCE_ID', connectInstanceId);
mediaLambda.addEnvironment('CONNECT_CONTACT_FLOW_ID', connectContactFlowId);
mediaLambda.addEnvironment('CONNECT_SOURCE_PHONE_NUMBER', connectSourcePhone);

voiceAgentTable.grantReadWriteData(lexFulfillmentLambda);
voiceAgentTable.grantReadWriteData(postCallAnalysisLambda);
voiceAgentTable.grantReadWriteData(chatLambda);
voiceAgentTable.grantReadWriteData(mediaLambda);
userProfilesTable.grantReadWriteData(postCallAnalysisLambda);
usageRecordsTable.grantReadWriteData(postCallAnalysisLambda);

const voiceBedrockPolicy = new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel', 'bedrock:Converse'],
  resources: ['*']
});
lexFulfillmentLambda.addToRolePolicy(voiceBedrockPolicy);
postCallAnalysisLambda.addToRolePolicy(voiceBedrockPolicy);

const connectArn = connectInstanceId 
  ? `arn:aws:connect:${customStack.region}:${customStack.account}:instance/${connectInstanceId}/*`
  : '*';

const connectPolicy = new iam.PolicyStatement({
  actions: ['connect:StartOutboundVoiceContact'],
  resources: [connectArn] 
});

chatLambda.addToRolePolicy(connectPolicy);
mediaLambda.addToRolePolicy(connectPolicy);

lexFulfillmentLambda.addPermission('LexInvokePermission', {
  principal: new iam.ServicePrincipal('lexv2.amazonaws.com'),
  action: 'lambda:InvokeFunction',
});

// UPDATED: Assigned to glueStack
const connectCtrRule = new events.Rule(glueStack, 'ConnectCtrDisconnectRule', {
  eventPattern: {
    source: ['aws.connect'],
    detailType: ['Amazon Connect Contact Event'],
    detail: { eventType: ['DISCONNECTED'] },
  },
});
connectCtrRule.addTarget(new targets.LambdaFunction(postCallAnalysisLambda));

// UPDATED: Assigned to glueStack
const modelSeederCustomResource = new cr.AwsCustomResource(glueStack, 'FoundationModelSeederResource', {
  onCreate: {
    service: 'Lambda',
    action: 'invoke',
    parameters: {
      FunctionName: seederLambda.functionName,
      InvocationType: 'RequestResponse',
    },
    physicalResourceId: cr.PhysicalResourceId.of('FoundationModelSeederTrigger'),
  },
  onUpdate: {
    service: 'Lambda',
    action: 'invoke',
    parameters: {
      FunctionName: seederLambda.functionName,
      InvocationType: 'RequestResponse',
    },
    physicalResourceId: cr.PhysicalResourceId.of(`FoundationModelSeederTrigger_${Date.now()}`),
  },
  policy: cr.AwsCustomResourcePolicy.fromStatements([
    new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [seederLambda.functionArn],
    }),
  ]),
});

modelSeederCustomResource.node.addDependency(foundationModelsTable);
modelSeederCustomResource.node.addDependency(seederLambda);