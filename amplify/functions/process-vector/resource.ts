import { defineFunction } from '@aws-amplify/backend';

export const processVector = defineFunction({
  name: 'process-vector',
  entry: './handler.ts',
  timeoutSeconds: 30,
});