import { defineFunction } from '@aws-amplify/backend';

export const syncKnowledgeBase = defineFunction({
  name: 'sync-knowledge-base',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data',
});