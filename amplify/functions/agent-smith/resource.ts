import { defineFunction } from '@aws-amplify/backend';

export const agentReaper = defineFunction({
  name: 'agent-reaper',
  entry: './handler.ts',
  schedule: 'every day',
  resourceGroupName: 'data',
});