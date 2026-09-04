import { defineFunction } from '@aws-amplify/backend';

export const foundationModelSeeder = defineFunction({
  name: 'foundation-model-seeder',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data',
});