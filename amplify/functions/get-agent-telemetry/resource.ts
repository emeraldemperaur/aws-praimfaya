import { defineFunction } from '@aws-amplify/backend';

export const getAgentTelemetry = defineFunction({
  name: 'get-agent-telemetry',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data',
});