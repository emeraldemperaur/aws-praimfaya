import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' as any });

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

export const handler = async (event: any) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed' || stripeEvent.type === 'invoice.paid') {
      let cognitoUserId = '';
      let mode = '';
      let priceId = '';
      let customerId = '';
      let periodEnd = new Date().toISOString(); 

      if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        cognitoUserId = session.client_reference_id!;
        customerId = session.customer as string;
        mode = session.mode;

        if (mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          priceId = subscription.items.data[0].price.id;
          
          // FIX #1: Access current_period_end on the item level, not the subscription level
          periodEnd = new Date(subscription.items.data[0].current_period_end * 1000).toISOString();
        } else {
          priceId = process.env.TOP_UP_PRICE_ID!;
        }
      } else if (stripeEvent.type === 'invoice.paid') {
        const invoice = stripeEvent.data.object as Stripe.Invoice;
        
        if (invoice.billing_reason === 'subscription_create') {
            return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }
        
        customerId = invoice.customer as string;
        mode = 'subscription';
        
        const rawPrice = invoice.lines.data[0].pricing?.price_details?.price;
        priceId = typeof rawPrice === 'string' ? rawPrice : (rawPrice as Stripe.Price)?.id || '';
        
        cognitoUserId = invoice.parent?.type === 'subscription_details' 
            ? invoice.parent.subscription_details?.metadata?.cognitoUserId as string
            : invoice.customer_email || 'UNKNOWN';
      }

      let planName = "VANGUARD"; 
      let allocatedCredits = 16400000;

      if (priceId === process.env.VANGUARD_ELITE_PRICE_ID) {
        planName = "VANGUARD_ELITE"; 
        allocatedCredits = 40000000;
      } else if (priceId === process.env.VANGUARD_PRICE_ID) {
        planName = "VANGUARD";       
        allocatedCredits = 16400000; 
      } else if (mode === 'payment') {
        planName = "TOP_UP";      
        allocatedCredits = 5000000;  
      } else {
        console.warn(`Unrecognized price ID: ${priceId}`);
        return { statusCode: 200, body: "Ignored unrecognized price." };
      }

      const recordId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      if (mode === 'subscription') {
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId },
                        UpdateExpression: "SET stripeCustomerId = :sid, subscriptionStatus = :status, planName = :plan, computeCredits = :credits, maxCredits = :credits, currentPeriodEnd = :periodEnd",
                        ExpressionAttributeValues: {
                            ":sid": customerId,
                            ":status": "ACTIVE",
                            ":plan": planName,
                            ":credits": allocatedCredits,
                            ":periodEnd": periodEnd,
                        }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE,
                        Item: { id: recordId, userId: cognitoUserId, sessionId: 'system-billing', sessionTitle: 'Subscription Purchase/Renewal', actionType: 'TOP_UP', creditsUsed: -allocatedCredits, createdAt: now }
                    }
                }
            ]
        }));
      } else if (mode === 'payment') {
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId },
                        UpdateExpression: "SET computeCredits = if_not_exists(computeCredits, :zero) + :topup, maxCredits = if_not_exists(maxCredits, :zero) + :topup",
                        ExpressionAttributeValues: { 
                            ":topup": allocatedCredits,
                            ":zero": 0
                        }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE,
                        Item: { id: recordId, userId: cognitoUserId, sessionId: 'system-billing', sessionTitle: 'One-Time Credit Top-Up', actionType: 'TOP_UP', creditsUsed: -allocatedCredits, createdAt: now }
                    }
                }
            ]
        }));
      }
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return { statusCode: 500, body: error.message };
  }
};