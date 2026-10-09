import { defineFunction } from '@aws-amplify/backend';

export const scriptWriter = defineFunction({
    name: 'vanguard-script-writer',
    entry: './handler.ts',
    timeoutSeconds: 120,
    environment: {
        MODEL_ID: 'amazon.nova-pro-v1:0'
    }
});