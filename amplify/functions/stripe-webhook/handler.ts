import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

export const handler = async (event: any) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' });
  const sig = event.headers['stripe-signature'];
  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const cognitoUserId = session.client_reference_id!;
      const customerId = session.customer as string;

      if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0].price.id;

        // Explicit plan mapping
        let planName = "Vanguard Pro";
        let allottedCredits = 5000000;

        if (priceId === process.env.STRIPE_PRICE_VANGUARD_ELITE) {
          planName = "Vanguard Elite";
          allottedCredits = 20000000;
        } else if (priceId === process.env.STRIPE_PRICE_VANGUARD) {
          planName = "Vanguard Pro";
          allottedCredits = 5000000;
        } else {
          console.warn(`Unrecognized subscription price ID: ${priceId}`);
        }

        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USER_PROFILES_TABLE_NAME!,
          Key: { cognitoUserId },
          UpdateExpression: "SET stripeCustomerId = :sid, subscriptionStatus = :status, planName = :plan, computeCredits = :credits, maxCredits = :credits, currentPeriodEnd = :periodEnd",
          ExpressionAttributeValues: {
            ":sid": customerId,
            ":status": "ACTIVE",
            ":plan": planName,
            ":credits": allottedCredits,
            ":periodEnd": new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
          }
        }));
      } else if (session.mode === 'payment') {
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USER_PROFILES_TABLE_NAME!,
          Key: { cognitoUserId },
          UpdateExpression: "SET computeCredits = computeCredits + :topup, maxCredits = maxCredits + :topup",
          ExpressionAttributeValues: { ":topup": 2000000 }
        }));
      }
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    return { statusCode: 500, body: error.message };
  }
};