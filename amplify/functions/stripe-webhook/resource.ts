import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeWebhook = defineFunction({
  name: 'stripe-webhook',
  entry: './handler.ts',
  resourceGroupName: 'data',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: secret('STRIPE_WEBHOOK_SECRET'),
    VANGUARD_PRICE_ID: process.env.VANGUARD_PRICE_ID || 'price_1UB4nDI2Coxc9y6EopiOCY2v',
    VANGUARD_ELITE_PRICE_ID: process.env.VANGUARD_ELITE_PRICE_ID || 'price_1UB4ppI2Coxc9y6ESB2H7uIS',
    TOP_UP_PRICE_ID: process.env.TOP_UP_PRICE_ID || 'price_1UB56mI2Coxc9y6Ejo4sGyve',
  }
});