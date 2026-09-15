import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client();

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
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: `${objectKey}.metadata.json`,
        Body: JSON.stringify(metadataPayload),
        ContentType: "application/json"
      }));

      console.log(`Successfully generated Bedrock metadata for ${fileName} in collection ${collectionId}`);
    } catch (error) {
      console.error(`Failed to write metadata for ${fileName}:`, error);
    }
  }
};