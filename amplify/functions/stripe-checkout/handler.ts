import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' as any });

export const handler = async (event: any) => {
  const cognitoUserId = event.identity.claims.sub;
  const { planTier } = event.arguments;

  let priceId = '';
  let mode: 'subscription' | 'payment' = 'subscription';

  if (planTier === 'VANGUARD') { 
      priceId = process.env.VANGUARD_PRICE_ID!; 
      mode = 'subscription'; 
  } else if (planTier === 'VANGUARD_ELITE') { 
      priceId = process.env.VANGUARD_ELITE_PRICE_ID!; 
      mode = 'subscription'; 
  } else if (planTier === 'TOP_UP') { 
      priceId = process.env.TOP_UP_PRICE_ID!; 
      mode = 'payment'; 
  }

  if (!priceId) {
      throw new Error(`Failed to resolve Stripe Price ID for tier: ${planTier}. Check environment variables.`);
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://vanguard.yourdomain.com';

  const paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
  if (mode === 'payment') {
      paymentMethods.push('crypto' as Stripe.Checkout.SessionCreateParams.PaymentMethodType); // USDC Stablecoin via Stripe
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: paymentMethods,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: mode,
    client_reference_id: cognitoUserId,
    allow_promotion_codes: true,
    subscription_data: mode === 'subscription' ? { metadata: { cognitoUserId } } : undefined,
    payment_intent_data: mode === 'payment' ? { metadata: { cognitoUserId } } : undefined,
    success_url: `${frontendUrl}/user-profile?checkout=success`,
    cancel_url: `${frontendUrl}/user-profile?checkout=canceled`,
  });

  return session.url;
};