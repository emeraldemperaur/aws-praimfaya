import { defineFunction } from '@aws-amplify/backend';

export const pollBedrock = defineFunction({
  name: 'poll-bedrock',
  entry: './handler.ts',
  timeoutSeconds: 15,
  resourceGroupName: 'data',
});