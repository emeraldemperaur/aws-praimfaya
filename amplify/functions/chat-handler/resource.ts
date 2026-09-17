import { defineFunction } from '@aws-amplify/backend';

export const chatHandler = defineFunction({
  name: 'chat-handler',
  entry: './handler.ts',
  timeoutSeconds: 40, 
  memoryMB: 512,
  resourceGroupName: 'data'
});