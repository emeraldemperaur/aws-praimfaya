import { defineFunction } from '@aws-amplify/backend';

export const postCallAnalysis = defineFunction({
  name: 'post-call-analysis',
  entry: './handler.ts',
  timeoutSeconds: 60,
  resourceGroupName: 'data',
});