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
import { RemovalPolicy } from 'aws-cdk-lib';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  vectorCollectionsS3,
  ragArtifactsS3,
  processVector
});

const customStack = backend.createStack('BedrockAIStack');

// 1. Create the S3 Vector Store Bucket explicitly using the s3vectors construct
const vectorBucket = new s3vectors.CfnVectorBucket(customStack, 'VectorBucket', {});

// 2. Create the explicit Vector Index inside that bucket
const vectorIndex = new s3vectors.CfnIndex(customStack, 'VectorIndex', {
  vectorBucketArn: vectorBucket.attrVectorBucketArn,
  dimension: 1024, 
  distanceMetric: 'cosine', 
  dataType: 'float32',
  metadataConfiguration: {
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
const bedrockKbRole = new iam.Role(customStack, 'BedrockKBRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

// Grant Bedrock read access to your Amplify Document Bucket
backend.vectorCollectionsS3.resources.bucket.grantRead(bedrockKbRole);

// Grant Bedrock full access to the explicit S3 Vector Bucket
bedrockKbRole.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
  resources: [
    vectorBucket.attrVectorBucketArn,
    `${vectorBucket.attrVectorBucketArn}/*`
  ]
}));

// Grant Bedrock permission to use the Nova Multimodal Embedding Model
bedrockKbRole.addToPolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: [`arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`],
}));

// 4. Create the Bedrock Knowledge Base (S3 Vectors + Nova)
const knowledgeBase = new bedrock.CfnKnowledgeBase(customStack, 'MultiTenantKB', {
  name: 'PraimfayaVectorPool',
  roleArn: bedrockKbRole.roleArn,
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: {
      embeddingModelArn: `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`,
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

// 5. Connect Amplify S3 Bucket as the Data Source
const dataSource = new bedrock.CfnDataSource(customStack, 'AmplifyDocumentSource', {
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
      chunkingStrategy: 'HIERARCHICAL' 
    }
  }
});

// 6. Wire up the Lambda Trigger & Break Circular Dependencies
const processVectorLambda = backend.processVector.resources.lambda;

// Grant Lambda permissions to look up the KB and trigger the ingestion job
processVectorLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'bedrock:ListKnowledgeBases',
    'bedrock:ListDataSources',
    'bedrock:StartIngestionJob'
  ],
  resources: ['*'] // Required for List APIs, StartIngestionJob will still only hit what it finds
}));

// Trigger Lambda on new file uploads
backend.vectorCollectionsS3.resources.bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processVectorLambda),
  { prefix: 'vector-collections/' }
);