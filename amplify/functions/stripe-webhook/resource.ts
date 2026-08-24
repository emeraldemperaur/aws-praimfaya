import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeWebhook = defineFunction({
  name: 'stripe-webhook',
  entry: './handler.ts',
  resourceGroupName: 'data',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
    STRIPE_PRICE_VANGUARD: process.env.STRIPE_PRICE_VANGUARD || 'price_1xxxxxxxxx',
    STRIPE_PRICE_VANGUARD_ELITE: process.env.STRIPE_PRICE_VANGUARD_ELITE || 'price_2xxxxxxxxx',
  }
});