import Stripe from 'stripe';

export const handler = async (event: any) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' });
  const cognitoUserId = event.identity.claims.sub;
  const { planTier } = event.arguments;

  let priceId = '';
  let mode: 'subscription' | 'payment' = 'subscription';

  if (planTier === 'VANGUARD') { priceId = process.env.STRIPE_PRICE_VANGUARD!; mode = 'subscription'; }
  else if (planTier === 'VANGUARD_ELITE') { priceId = process.env.STRIPE_PRICE_VANGUARD_ELITE!; mode = 'subscription'; }
  else if (planTier === 'TOP_UP') { priceId = process.env.STRIPE_PRICE_TOPUP!; mode = 'payment'; }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: mode,
    client_reference_id: cognitoUserId,
    allow_promotion_codes: true,
    success_url: `${process.env.FRONTEND_URL}/user-profile?checkout=success`,
    cancel_url: `${process.env.FRONTEND_URL}/user-profile?checkout=canceled`,
  });

  return session.url;
};