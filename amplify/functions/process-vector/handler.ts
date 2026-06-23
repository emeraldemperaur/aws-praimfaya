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

const getBedrockIds = async () => {
  const kbResponse = await bedrockClient.send(new ListKnowledgeBasesCommand({ maxResults: 10 }));
  const kb = kbResponse.knowledgeBaseSummaries?.find(k => k.name === 'PraimfayaVectorPool');
  
  if (!kb?.knowledgeBaseId) throw new Error("Knowledge Base not found!");

  const dsResponse = await bedrockClient.send(new ListDataSourcesCommand({
    knowledgeBaseId: kb.knowledgeBaseId,
    maxResults: 10
  }));
  const ds = dsResponse.dataSourceSummaries?.find(d => d.name === 'AmplifyS3DataSource');

  if (!ds?.dataSourceId) throw new Error("Data Source not found!");

  return { kbId: kb.knowledgeBaseId, dsId: ds.dataSourceId };
};

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    if (objectKey.endsWith('.metadata.json')) continue;

    const pathParts = objectKey.split('/');
    if (pathParts.length < 4) continue; 
    
    const identityId = pathParts[1];
    const collectionId = pathParts[2];
    const fileName = pathParts[pathParts.length - 1];

    const metadataPayload = {
      metadataAttributes: {
        collectionId: collectionId,
        ownerId: identityId,
      }
    };
    
    const metadataKey = `${objectKey}.metadata.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: metadataKey,
      Body: JSON.stringify(metadataPayload),
      ContentType: "application/json"
    }));

    const { errors } = await dataClient.models.VectorDocument.create({
      collectionId: collectionId,
      textContent: fileName, 
      sourceMetadata: JSON.stringify({
        fileName: fileName,
        s3Path: objectKey,
        status: 'Indexed'
      })
    });
    if (errors) console.error("Database Error:", errors);

    const { kbId, dsId } = await getBedrockIds();

    await bedrockClient.send(new StartIngestionJobCommand({
      knowledgeBaseId: kbId,
      dataSourceId: dsId,
      description: `Ingesting ${fileName}`
    }));

    console.log(`Successfully processed ${fileName}`);
  }
};