import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { vectorCollectionsS3, ragArtifactsS3 } from './storage/resource';
import { processVector } from './functions/process-vector/resource';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';

const backend = defineBackend({
  auth,
  data,
  vectorCollectionsS3,
  ragArtifactsS3,
  processVector
});

const praimfayaStack = backend.createStack('PraimfayaAI');

// 1. Create the S3 Vector Store Bucket explicitly
const vectorBucket = new s3vectors.CfnVectorBucket(praimfayaStack, 'VectorBucket', {});

// 2. Create the Vector Index (Titan Text V2 outputs 1024 dimensions)
const vectorIndex = new s3vectors.CfnIndex(praimfayaStack, 'VectorIndex', {
  vectorBucketArn: vectorBucket.attrVectorBucketArn,
  dimension: 1024, 
  distanceMetric: 'cosine', 
  dataType: 'float32',
  metadataConfiguration: {
    // Prevents Bedrock's massive internal chunks from crashing S3 Vectors
    nonFilterableMetadataKeys: [
      'AMAZON_BEDROCK_TEXT', 
      'AMAZON_BEDROCK_METADATA',
      'x-amz-bedrock-kb-source-uri',
      'x-amz-bedrock-kb-chunk-id',
      'x-amz-bedrock-kb-data-source-id'
    ]
  }
});

// 3. Define IAM Role for Bedrock
const bedrockKbRole = new iam.Role(praimfayaStack, 'BedrockKBRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

// Create an explicit IAM Policy to prevent CloudFormation race conditions
const bedrockKbPolicy = new iam.Policy(praimfayaStack, 'BedrockKBPolicy', {
  statements: [
    // Grant Bedrock full API access to the new S3 Vectors mathematical engine
    new iam.PolicyStatement({
      actions: [
        's3vectors:QueryVectors',
        's3vectors:PutVectors',
        's3vectors:DeleteVectors',
        's3vectors:GetVectors',
        's3vectors:GetVectorBucket',
        's3vectors:ListIndexes'
      ],
      resources: [
        vectorBucket.attrVectorBucketArn,
        vectorIndex.attrIndexArn, 
        `${vectorBucket.attrVectorBucketArn}/*`
      ]
    }),
    // Grant permission to use Titan Embed Text v2
    new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [`arn:aws:bedrock:${praimfayaStack.region}::foundation-model/amazon.titan-embed-text-v2:0`],
    }),
    // Grant read access to the Amplify document uploads bucket
    new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [
        backend.vectorCollectionsS3.resources.bucket.bucketArn,
        `${backend.vectorCollectionsS3.resources.bucket.bucketArn}/*`
      ]
    })
  ]
});

// Attach the explicit policy to the role
bedrockKbRole.attachInlinePolicy(bedrockKbPolicy);

// 4. Create the Bedrock Knowledge Base (Text-Only, Highly Stable)
const knowledgeBase = new bedrock.CfnKnowledgeBase(praimfayaStack, 'MultiTenantKB', {
  name: 'PraimfayaVectorPool',
  roleArn: bedrockKbRole.roleArn,
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: {
      embeddingModelArn: `arn:aws:bedrock:${praimfayaStack.region}::foundation-model/amazon.titan-embed-text-v2:0`,
    }
  },
  storageConfiguration: {
    type: 'S3_VECTORS',
    s3VectorsConfiguration: {
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
      indexName: vectorIndex.indexName!, 
      indexArn: vectorIndex.attrIndexArn,
    }
  }
});

// FORCE CFN WAITS: Kill the race conditions so IAM and S3 Vectors exist first
knowledgeBase.node.addDependency(vectorIndex);
knowledgeBase.node.addDependency(bedrockKbPolicy);

// 5. Connect Amplify S3 Bucket as the Data Source (Hierarchical Chunking)
const dataSource = new bedrock.CfnDataSource(praimfayaStack, 'AmplifyDocumentSource', {
  knowledgeBaseId: knowledgeBase.ref,
  name: 'AmplifyS3DataSource',
  dataSourceConfiguration: {
    type: 'S3',
    s3Configuration: {
      bucketArn: backend.vectorCollectionsS3.resources.bucket.bucketArn,
      inclusionPrefixes: ['vector-collections/'] 
    }
  },
  vectorIngestionConfiguration: {
    chunkingConfiguration: { 
      chunkingStrategy: 'HIERARCHICAL',
      // Explicitly define the parent/child token limits
      hierarchicalChunkingConfiguration: {
        levelConfigurations: [
          { maxTokens: 1500 }, // The Parent Chunk (Sent to the LLM for context)
          { maxTokens: 300 }   // The Child Chunk (Used for exact vector searching)
        ],
        overlapTokens: 60      // Prevents hard cutoffs mid-sentence
      }
    }
  }
});

// 6. Wire up the Lambda Trigger
const processVectorLambda = backend.processVector.resources.lambda;

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