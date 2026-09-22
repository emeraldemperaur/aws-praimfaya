import { defineFunction } from '@aws-amplify/backend';

export const updateUserGroup = defineFunction({
  name: 'updateUserGroup',
  entry: './handler.ts',
  timeoutSeconds: 15, 
  resourceGroupName: 'auth',
});