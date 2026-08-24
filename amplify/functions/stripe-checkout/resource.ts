import { defineFunction, secret } from '@aws-amplify/backend';

export const createCheckoutSession = defineFunction({
  name: 'create-checkout-session',
  entry: './handler.ts',
  resourceGroupName: 'data',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    STRIPE_PRICE_VANGUARD: process.env.STRIPE_PRICE_VANGUARD || 'price_1xxxxxxxxx',
    STRIPE_PRICE_VANGUARD_ELITE: process.env.STRIPE_PRICE_VANGUARD_ELITE || 'price_2xxxxxxxxx',
    STRIPE_PRICE_TOPUP: process.env.STRIPE_PRICE_TOPUP || 'price_3xxxxxxxxx',
  }
});