import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';


const s3Client = new S3Client();
const bedrockClient = new BedrockAgentClient();
const dataClient = generateClient<Schema>();

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Prevent infinite loops from the trigger
    if (objectKey.endsWith('.metadata.json')) continue;

    // Expected path: vector-collections/{identityId}/{collectionId}/{filename}
    const pathParts = objectKey.split('/');
    if (pathParts.length < 4) continue; 
    
    const identityId = pathParts[1];
    const collectionId = pathParts[2];
    const fileName = pathParts[pathParts.length - 1];

    // Write the RBAC Metadata to S3
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

    // Create the Database Record
    const { data: newDoc, errors } = await dataClient.models.VectorDocument.create({
      collectionId: collectionId,
      textContent: fileName, 
      sourceMetadata: JSON.stringify({
        fileName: fileName,
        s3Path: objectKey,
        status: 'Indexed'
      })
    });
    if (errors) console.error("Database Error:", errors);

    // Trigger Bedrock Knowledge Base Ingestion
    // Process.env handles dynamic injection from CDK backend.ts
    await bedrockClient.send(new StartIngestionJobCommand({
      knowledgeBaseId: process.env.BEDROCK_KB_ID as string,
      dataSourceId: process.env.BEDROCK_DS_ID as string,
      description: `Ingesting ${fileName}`
    }));

    console.log(`Successfully processed ${fileName}`);
  }
};