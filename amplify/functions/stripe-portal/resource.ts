import { defineFunction, secret } from '@aws-amplify/backend';

export const createPortalSession = defineFunction({
  name: 'stripe-portal',
  entry: './handler.ts',
  resourceGroupName: 'data',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://prometheus-fire.dcie4i9xtobfi.amplifyapp.com/user-profile'
  }
});