import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { 
  BedrockAgentClient, 
  StartIngestionJobCommand,
  ListKnowledgeBasesCommand,
  ListDataSourcesCommand
} from "@aws-sdk/client-bedrock-agent";
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';

const s3Client = new S3Client();
const bedrockClient = new BedrockAgentClient();
const dataClient = generateClient<Schema>();

const getBedrockIds = async (targetKbName: string, targetDsName: string) => {
  const kbResponse = await bedrockClient.send(new ListKnowledgeBasesCommand({ maxResults: 10 }));
  const kb = kbResponse.knowledgeBaseSummaries?.find(k => k.name === targetKbName);
  
  if (!kb?.knowledgeBaseId) throw new Error(`Knowledge Base '${targetKbName}' not found!`);

  const dsResponse = await bedrockClient.send(new ListDataSourcesCommand({
    knowledgeBaseId: kb.knowledgeBaseId,
    maxResults: 10
  }));
  const ds = dsResponse.dataSourceSummaries?.find(d => d.name === targetDsName);

  if (!ds?.dataSourceId) throw new Error(`Data Source '${targetDsName}' not found!`);

  return { kbId: kb.knowledgeBaseId, dsId: ds.dataSourceId };
};

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    if (objectKey.endsWith('.metadata.json')) continue;

    const pathParts = objectKey.split('/');
    if (pathParts.length < 5) continue; 
    
    const subFolder = pathParts[1]; 
    const identityId = pathParts[2];
    const collectionId = pathParts[3];
    const fileName = pathParts[pathParts.length - 1];

    const metadataPayload = {
      metadataAttributes: { collectionId, ownerId: identityId }
    };
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: `${objectKey}.metadata.json`,
      Body: JSON.stringify(metadataPayload),
      ContentType: "application/json"
    }));

    // 1. Determine target database
    let targetKbName = '';
    let targetDsName = '';
    if (subFolder === 'text') {
      targetKbName = 'TitanTextKB';
      targetDsName = 'TitanTextDataSource';
    } else if (subFolder === 'media') {
      targetKbName = 'NovaMediaKB';
      targetDsName = 'NovaMediaDataSource';
    } else {
      continue;
    }

    // 2. Start the Bedrock Job FIRST
    const { kbId, dsId } = await getBedrockIds(targetKbName, targetDsName);
    
    const jobResponse = await bedrockClient.send(new StartIngestionJobCommand({
      knowledgeBaseId: kbId,
      dataSourceId: dsId,
      description: `Ingesting ${fileName} into ${targetKbName}`
    }));

    const jobId = jobResponse.ingestionJob?.ingestionJobId;

    // 3. Write to DynamoDB with the exact Bedrock Job ID and a Processing status
    const { errors } = await dataClient.models.VectorDocument.create({
      collectionId: collectionId,
      textContent: fileName, 
      sourceMetadata: JSON.stringify({
        fileName: fileName,
        s3Path: objectKey,
        status: 'Processing', // <--- Accurate initial state
        jobId: jobId          // <--- The tracking correlation ID
      })
    });

    if (errors) console.error("Database Error:", errors);
    console.log(`Job ${jobId} started for ${fileName}`);
  }
};