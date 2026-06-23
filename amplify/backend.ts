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
import * as cr from 'aws-cdk-lib/custom-resources';
import { RemovalPolicy } from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data,
  vectorCollectionsS3,
  ragArtifactsS3,
  processVector
});

const customStack = backend.createStack('BedrockAIStack');

// 1. Create the S3 Vector Store Bucket
const vectorBucket = new s3vectors.CfnVectorBucket(customStack, 'VectorBucket', {});

// 2. Create the Vector Index (Nova outputs 1024 dimensions)
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

// 3. Create the Multimodal Storage Bucket
const multimodalBucket = new s3.Bucket(customStack, 'MultimodalStorageBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.DESTROY, 
  autoDeleteObjects: true,
});

// 4. Define IAM Role for Bedrock
const bedrockKbRole = new iam.Role(customStack, 'BedrockKBRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
});

// Grant read access to user uploads
backend.vectorCollectionsS3.resources.bucket.grantRead(bedrockKbRole);

// Grant Bedrock full API access to the new S3 Vectors mathematical engine
bedrockKbRole.addToPolicy(new iam.PolicyStatement({
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
    vectorIndex.attrIndexArn, // Explicitly grant access to the Index ARN
    `${vectorBucket.attrVectorBucketArn}/*`
  ]
}));

// Grant full access to Multimodal Bucket
multimodalBucket.grantReadWrite(bedrockKbRole);

// Grant permission to use Nova Multimodal
bedrockKbRole.addToPolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: [`arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`],
}));

// 5. Bypass CloudFormation and call the AWS SDK directly to create the Knowledge Base
const createKbCr = new cr.AwsCustomResource(customStack, 'NovaKnowledgeBaseCR', {
  onCreate: {
    service: 'BedrockAgent',
    action: 'CreateKnowledgeBaseCommand',
    parameters: {
      name: 'PraimfayaVectorPool',
      roleArn: bedrockKbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${customStack.region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`,
          supplementalDataStorageConfiguration: {
            storageLocations: [{
              type: 'S3', 
              s3Location: { uri: `s3://${multimodalBucket.bucketName}/` }
            }]
          }
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
    },
    physicalResourceId: cr.PhysicalResourceId.fromResponse('knowledgeBase.knowledgeBaseId'),
  },
  onDelete: {
    service: 'BedrockAgent',
    action: 'DeleteKnowledgeBaseCommand',
    parameters: {
      knowledgeBaseId: new cr.PhysicalResourceIdReference() 
    }
  },
  policy: cr.AwsCustomResourcePolicy.fromStatements([
    new iam.PolicyStatement({
      actions: ['bedrock:CreateKnowledgeBase', 'bedrock:DeleteKnowledgeBase'],
      resources: ['*'],
    }),
    new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [bedrockKbRole.roleArn], 
    })
  ]),
});

// Force the custom resource to wait until the Index and Buckets are fully deployed
createKbCr.node.addDependency(vectorIndex);
createKbCr.node.addDependency(multimodalBucket);

// 6. Connect Amplify S3 Bucket as the Data Source
const dataSource = new bedrock.CfnDataSource(customStack, 'AmplifyDocumentSource', {
  // Pull the dynamically generated ID directly from the Custom Resource output
  knowledgeBaseId: createKbCr.getResponseField('knowledgeBase.knowledgeBaseId'),
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

// 7. Wire up the Lambda Trigger
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