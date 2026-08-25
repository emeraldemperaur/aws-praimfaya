import { defineFunction } from '@aws-amplify/backend';

export const webhookRouter = defineFunction({
  name: 'webhook-router',
  entry: './handler.ts',
  timeoutSeconds: 780, 
  resourceGroupName: 'data',
});