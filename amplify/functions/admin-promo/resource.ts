import { defineFunction } from '@aws-amplify/backend';
export const grantPromoCredits = defineFunction({ 
    name: 'grant-promo-credits', 
    entry: './handler.ts',
    resourceGroupName: 'data',
});