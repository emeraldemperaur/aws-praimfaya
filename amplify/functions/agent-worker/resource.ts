import { defineFunction } from '@aws-amplify/backend';

export const agentWorker = defineFunction({
  name: 'agent-worker',
  entry: './handler.ts',
  timeoutSeconds: 900, 
  memoryMB: 1024,
});