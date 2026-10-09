import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  entry: './handler.ts',
  environment: {
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || 'info@mekaegwim.ca' 
  }
});