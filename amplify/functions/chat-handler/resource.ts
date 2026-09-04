import { defineFunction } from '@aws-amplify/backend';

export const chatHandler = defineFunction({
  name: 'chat-handler',
  entry: './handler.ts',
  timeoutSeconds: 900, 
  memoryMB: 1024,
  resourceGroupName: 'data',
  environment: {
    MEDIA_OUTPUT_BUCKET_NAME: process.env.MEDIA_OUTPUT_BUCKET_NAME || 'praimfaya-media-outputs'
  }
});