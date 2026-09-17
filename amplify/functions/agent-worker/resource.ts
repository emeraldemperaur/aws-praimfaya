import { defineFunction } from '@aws-amplify/backend';

export const agentWorker = defineFunction({
  name: 'agent-worker',
  entry: './handler.ts',
  timeoutSeconds: 900, 
  resourceGroupName: 'data',
  memoryMB: 1024,
  environment: {
    MEDIA_OUTPUT_BUCKET_NAME: process.env.MEDIA_OUTPUT_BUCKET_NAME || 'praimfaya-media-outputs',
    VECTOR_COLLECTIONS_BUCKET_NAME: process.env.VECTOR_COLLECTIONS_BUCKET_NAME || 'praimfaya-vector-collections',
  }
});