import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';

const dataClient = generateClient<Schema>();

export const handler = async (event: any) => {
  const jobId = event.detail.ingestionJobId;
  const newStatus = event.detail.status; 

  console.log(`Received Bedrock Event for Job: ${jobId} with Status: ${newStatus}`);

  const { data: documents } = await dataClient.models.VectorDocument.list();
  
  const targetDoc = documents.find(doc => {
    if (!doc.sourceMetadata) return false;
    try {
      const metaString = doc.sourceMetadata as string;
      const meta = JSON.parse(metaString);
      return meta.jobId === jobId && meta.status === 'Processing';
    } catch {
      return false;
    }
  });

  if (!targetDoc) {
    console.log(`Could not find a processing document for Job ID: ${jobId}`);
    return;
  }

  const uiStatus = newStatus === 'COMPLETE' ? 'Indexed' : 'Failed';
  
  const updatedMetadata = { 
    ...JSON.parse(targetDoc.sourceMetadata as string), 
    status: uiStatus 
  };

  const { errors } = await dataClient.models.VectorDocument.update({
    id: targetDoc.id,
    sourceMetadata: JSON.stringify(updatedMetadata)
  });

  if (errors) {
    console.error("Failed to update status in DynamoDB:", errors);
  } else {
    console.log(`Successfully updated ${targetDoc.textContent} to ${uiStatus}`);
  }
};