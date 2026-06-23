import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { vectorCollectionsS3, ragArtifactsS3 } from './storage/resource';
import { processVector } from './functions/process-vector/resource';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
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

// 1. Create the S3 Vector Store Bucket (Hidden from frontend)
const vectorStoreBucket = new s3.Bucket(customStack, 'S3VectorStoreBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.DESTROY, // Change to RETAIN in production
  autoDeleteObjects: true,
});

// 2. Define IAM Role for Bedrock
const bedrockKbRole = new iam.Role(customStack, 'BedrockKBRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

// Grant Bedrock read access to your Amplify Document Bucket
backend.vectorCollectionsS3.resources.bucket.grantRead(bedrockKbRole);
// Grant Bedrock full access to the S3 Vector Store Bucket
vectorStoreBucket.grantReadWrite(bedrockKbRole);

// Grant Bedrock permission to use the Nova Multimodal Embedding Model
bedrockKbRole.addToPolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: ['arn:aws:bedrock:*::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0'],
}));

// 3. Create the Bedrock Knowledge Base (S3 Vectors + Nova)
const knowledgeBase = new bedrock.CfnKnowledgeBase(customStack, 'MultiTenantKB', {
  name: 'MultiTenantVectorPool',
  roleArn: bedrockKbRole.roleArn,
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: {
      embeddingModelArn: 'arn:aws:bedrock:*::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0',
    }
  },
  storageConfiguration: {
    type: 'S3_VECTORS',
    s3VectorsConfiguration: {
      vectorBucketArn: vectorStoreBucket.bucketArn,
      indexName: 'default-index', 
    }
  }
});

// 4. Connect Amplify S3 Bucket as the Data Source
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

// 5. Wire up the Lambda Trigger & Environment Variables
const processVectorLambda = backend.processVector.resources.lambda;

// Grant Lambda permissions to trigger Bedrock Ingestion
processVectorLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:StartIngestionJob'],
  resources: [`arn:aws:bedrock:${customStack.region}:${customStack.account}:knowledge-base/${knowledgeBase.ref}`]
}));

// Inject the dynamic CDK IDs into the Lambda execution environment
backend.processVector.addEnvironment('BEDROCK_KB_ID', knowledgeBase.ref);
backend.processVector.addEnvironment('BEDROCK_DS_ID', dataSource.ref);

// Trigger Lambda on new file uploads
backend.vectorCollectionsS3.resources.bucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.LambdaDestination(processVectorLambda),
  { prefix: 'vector-collections/' }
);


