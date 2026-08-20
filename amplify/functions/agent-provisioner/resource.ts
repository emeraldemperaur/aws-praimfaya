import { defineFunction } from '@aws-amplify/backend';

export const agentProvisioner = defineFunction({
  name: 'agent-provisioner',
  entry: './handler.ts',
  timeoutSeconds: 300,
});