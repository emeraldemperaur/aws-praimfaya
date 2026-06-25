import { defineFunction } from '@aws-amplify/backend';

export const updateVectorStatus = defineFunction({
  name: 'update-vector-status',
  entry: './handler.ts',
  resourceGroupName: 'storage'
});