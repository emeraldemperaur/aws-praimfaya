import { defineFunction } from '@aws-amplify/backend';

export const chatHandler = defineFunction({
  name: 'chat-handler',
  entry: './handler.ts',
  timeoutSeconds: 30, 
  memoryMB: 1024,
  resourceGroupName: 'data'
});