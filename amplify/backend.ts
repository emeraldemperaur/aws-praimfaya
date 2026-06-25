import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { vectorCollectionsS3, ragArtifactsS3 } from './storage/resource';
import { processVector } from './functions/process-vector/resource';
import { updateVectorStatus } from './functions/update-vector-status/resource';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { RemovalPolicy } from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data,
  vectorCollectionsS3,
  ragArtifactsS3,
  processVector,
  updateVectorStatus
});

const customStack = backend.createStack('BedrockAIStack');

// =====================================================================
// 1. CENTRAL VECTOR STORAGE
// =====================================================================
const vectorBucket = new s3vectors.CfnVectorBucket(customStack, 'CentralVectorBucket', {});

// Database Index #1: Titan Text (1024 Dimensions)
const titanIndex = new s3vectors.CfnIndex(customStack, 'TitanTextIndex', {
  vectorBucketArn: vectorBucket.attrVectorBucketArn,
  dimension: 1024, 
  distanceMetric: 'cosine', 
  dataType: 'float32',
  metadataConfiguration: {
    nonFilterableMetadataKeys: ['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA', 'x-amz-bedrock-kb-source-uri', 'x-amz-bedrock-kb-chunk-id', 'x-amz-bedrock-kb-data-source-id']
  }
});

// Database Index #2: Nova Multimodal (1024 Dimensions)
const novaIndex = new s3vectors.CfnIndex(customStack, 'NovaMediaIndex', {
  vectorBucketArn: vectorBucket.attrVectorBucketArn,
  dimension: 1024, 
  distanceMetric: 'cosine', 
  dataType: 'float32',
  metadataConfiguration: {
    nonFilterableMetadataKeys: ['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA', 'x-amz-bedrock-kb-source-uri', 'x-amz-bedrock-kb-chunk-id', 'x-amz-bedrock-kb-data-source-id']
  }
});

// Supplemental S3 Bucket for Nova's Multimodal extraction operations
const multimodalBucket = new s3.Bucket(customStack, 'MultimodalStorageBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.DESTROY, 
  autoDeleteObjects: true,
});

// =====================================================================
// 2. SHARED KNOWLEDGE BASE IAM PERMISSIONS
// =====================================================================
const bedrockKbRole = new iam.Role(customStack, 'BedrockKBRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

const bedrockKbPolicy = new iam.Policy(customStack, 'BedrockKBPolicy', {
  statements: [
    // S3 Vectors API Access
    new iam.PolicyStatement({
      actions: ['s3vectors:QueryVectors', 's3vectors:PutVectors', 's3vectors:DeleteVectors', 's3vectors:GetVectors', 's3vectors:GetVectorBucket', 's3vectors:ListIndexes'],
      resources: [vectorBucket.attrVectorBucketArn, titanIndex.attrIndexArn, novaIndex.attrIndexArn, `${vectorBucket.attrVectorBucketArn}/*`]
    }),
    // Invoke both embedding models
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.titan-embed-text-v2:0`,
        `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`
      ],
    }),
    // Read access to Amplify upload bucket and write access to multimodal bucket
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

// =====================================================================
// 3. ARCHITECTURE A: TITAN TEXT KNOWLEDGE BASE
// =====================================================================
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

// Text Data Source pointing to the /text/ prefix with HIERARCHICAL chunking
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

// =====================================================================
// 4. ARCHITECTURE B: NOVA MULTIMODAL KNOWLEDGE BASE
// =====================================================================
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

// Media Data Source pointing to the /media/ prefix (Bedrock handles media defaults automatically)
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

// =====================================================================
// 5. THE INGESTION TRIGGER (Wiring S3 to the processVector Lambda)
// =====================================================================
const processVectorLambda = backend.processVector.resources.lambda;

// Allow the Lambda to read uploaded files and write metadata.json files
backend.vectorCollectionsS3.resources.bucket.grantReadWrite(processVectorLambda);

// Allow the Lambda to list the KBs and trigger the Bedrock Ingestion Jobs
processVectorLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'bedrock:ListKnowledgeBases',
    'bedrock:ListDataSources',
    'bedrock:StartIngestionJob'
  ],
  resources: ['*'] 
}));

// Tell S3 to fire the Lambda every time a new file lands in the vector-collections folder
backend.vectorCollectionsS3.resources.bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processVectorLambda),
  { prefix: 'vector-collections/' }
);

// =====================================================================
// 6. EVENT-DRIVEN STATUS TRACKING (EventBridge -> DynamoDB)
// =====================================================================
const statusLambda = backend.updateVectorStatus.resources.lambda;

// Listen for Amazon Bedrock Knowledge Base Ingestion state changes
const bedrockEventRule = new events.Rule(customStack, 'BedrockIngestionStatusRule', {
  eventPattern: {
    source: ['aws.bedrock'],
    detailType: ['Bedrock Knowledge Base Ingestion Job State Change'],
  },
});

// Route the event payload to your new webhook Lambda
bedrockEventRule.addTarget(new targets.LambdaFunction(statusLambda));