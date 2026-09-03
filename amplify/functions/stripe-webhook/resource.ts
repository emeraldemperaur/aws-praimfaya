import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeWebhook = defineFunction({
  name: 'stripe-webhook',
  entry: './handler.ts',
  resourceGroupName: 'data',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
    STRIPE_PRICE_VANGUARD: process.env.STRIPE_PRICE_VANGUARD || 'price_1UB4nDI2Coxc9y6EopiOCY2v',
    STRIPE_PRICE_VANGUARD_ELITE: process.env.STRIPE_PRICE_VANGUARD_ELITE || 'price_1UB4nDI2Coxc9y6EopiOCY2v',
  }
});