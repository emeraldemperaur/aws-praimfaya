import { defineFunction } from '@aws-amplify/backend';

export const multimediaExecutor = defineFunction({
  name: 'multimedia-executor',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 1024,
  resourceGroupName: 'data',
  environment: {
    MEDIA_OUTPUT_BUCKET_NAME: process.env.MEDIA_OUTPUT_BUCKET_NAME || 'praimfaya-media-outputs'
  }
});