import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';

const s3Client = new S3Client();
const dataClient = generateClient<Schema>();

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    if (objectKey.endsWith('.metadata.json')) continue;

    const pathParts = objectKey.split('/');
    if (pathParts.length < 5) continue; 
    
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

    const { errors } = await dataClient.models.VectorDocument.create({
      collectionId: collectionId,
      textContent: fileName, 
      sourceMetadata: JSON.stringify({
        fileName: fileName,
        s3Path: objectKey,
        status: 'UNSYNCED' 
      })
    });

    if (errors) console.error("Database Error:", errors);
    console.log(`Document ${fileName} uploaded and marked UNSYNCED for collection ${collectionId}`);
  }
};