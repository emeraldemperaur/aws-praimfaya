import { defineFunction } from '@aws-amplify/backend';

export const multimediaExecutor = defineFunction({
  name: 'multimedia-executor',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 1024,
  resourceGroupName: 'data'
});