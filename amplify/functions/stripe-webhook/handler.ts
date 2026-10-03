import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const getProfileId = async (cognitoUserId: string): Promise<string> => {
  console.log(`[TRACE] Lookup UserProfile for cognitoUserId: ${cognitoUserId}`);
  const query = await dynamodb.send(new QueryCommand({
      TableName: USER_PROFILES_TABLE,
      IndexName: "byCognitoId",
      KeyConditionExpression: "cognitoUserId = :uid",
      ExpressionAttributeValues: { ":uid": cognitoUserId }
  }));
  
  if (!query.Items || query.Items.length === 0) {
      throw new Error(`No UserProfile found in database for cognitoUserId: ${cognitoUserId}`);
  }
  return query.Items[0].id;
};

export const handler = async (event: any) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    console.log(`[TRACE] Received Event: ${stripeEvent.type}`);
  } catch (err: any) {
    console.error(`[TRACE] Webhook signature verification failed: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'invoice.paid') {
      const invoice = stripeEvent.data.object as any;
      const billingReason = invoice.billing_reason;
      
      if (billingReason === 'subscription_update' || invoice.lines?.data?.[0]?.proration === true) {
          console.log(`[TRACE] EXIT: Ignoring prorated subscription update invoice ${invoice.id}.`);
          return { statusCode: 200, body: "Ignored prorated invoice." };
      }

      const customerId = invoice.customer;
      const monetaryValue = (invoice.amount_paid || 0) / 100;
      const invoiceId = invoice.id;
      const rawPeriodEnd = invoice.lines?.data?.[0]?.period?.end;
      const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : new Date().toISOString();
      const priceId = invoice.lines?.data?.[0]?.pricing?.price_details?.price 
                   || invoice.lines?.data?.[0]?.price?.id 
                   || invoice.lines?.data?.[0]?.plan?.id 
                   || '';
      
      let cognitoUserId = invoice.parent?.subscription_details?.metadata?.cognitoUserId;
      if (!cognitoUserId) {
        cognitoUserId = invoice.lines?.data?.[0]?.metadata?.cognitoUserId;
      }

      if (!cognitoUserId) {
        console.error(`[TRACE] EXIT: Missing cognitoUserId metadata for invoice: ${invoiceId}`);
        return { statusCode: 200, body: "Ignored unrecognized user." };
      }

      let planName = "VANGUARD";
      let allocatedCredits = 16400000;

      if (priceId === process.env.VANGUARD_ELITE_PRICE_ID) {
        planName = "VANGUARD_ELITE";
        allocatedCredits = 40000000;
      } else if (priceId === process.env.VANGUARD_PRICE_ID) {
        planName = "VANGUARD";
        allocatedCredits = 16400000;
      } else {
        console.warn(`[TRACE] EXIT: Ignored unrecognized Stripe Price ID: ${priceId}`);
        return { statusCode: 200, body: "Ignored unrecognized price." };
      }

      const userProfileId = await getProfileId(cognitoUserId);
      const uniqueEventId = stripeEvent.id; 
      const now = new Date().toISOString();

      await dynamodb.send(new TransactWriteCommand({
          TransactItems: [
              {
                  Update: {
                      TableName: USER_PROFILES_TABLE,
                      Key: { id: userProfileId },
                      UpdateExpression: "SET stripeCustomerId = :sid, subscriptionStatus = :status, planName = :plan, computeCredits = if_not_exists(computeCredits, :zero) + :credits, maxCredits = if_not_exists(maxCredits, :zero) + :credits, currentPeriodEnd = :periodEnd",
                      ExpressionAttributeValues: {
                          ":sid": customerId,
                          ":status": "ACTIVE",
                          ":plan": planName,
                          ":credits": allocatedCredits,
                          ":periodEnd": periodEnd,
                          ":zero": 0
                      }
                  }
              },
              {
                  Put: {
                      TableName: USAGE_RECORDS_TABLE,
                      ConditionExpression: "attribute_not_exists(id)", 
                      Item: { 
                        __typename: 'UsageRecord', 
                        id: uniqueEventId, 
                        userId: cognitoUserId, 
                        sessionId: 'system-billing', 
                        sessionTitle: 'Subscription Purchase/Renewal', 
                        actionType: 'TOP_UP', 
                        creditsUsed: allocatedCredits, 
                        monetaryValue: monetaryValue,     
                        stripeInvoiceId: invoiceId,
                        createdAt: now 
                      }
                  }
              }
          ]
      }));
      console.log(`[TRACE] SUCCESS: DynamoDB transaction completed for subscription.`);
    }

    else if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as any;
      
      if (session.mode === 'subscription') {
          console.log(`[TRACE] EXIT: Delegating subscription session to invoice.paid.`);
          return { statusCode: 200, body: JSON.stringify({ received: true, note: 'Delegated to invoice.paid' }) };
      }

      const cognitoUserId = session.client_reference_id;
      if (!cognitoUserId) {
        console.error(`[TRACE] EXIT: Missing client_reference_id for session: ${session.id}`);
        return { statusCode: 200, body: "Ignored unrecognized user." };
      }

      if (session.mode === 'payment') {
        const monetaryValue = (session.amount_total || 0) / 100;
        const invoiceId = session.invoice || `cs_${session.id}`;
        const allocatedCredits = 5000000;
        
        const userProfileId = await getProfileId(cognitoUserId);
        const uniqueEventId = stripeEvent.id; 
        const now = new Date().toISOString();

        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { id: userProfileId },
                        UpdateExpression: "SET computeCredits = if_not_exists(computeCredits, :zero) + :topup, maxCredits = if_not_exists(maxCredits, :zero) + :topup",
                        ExpressionAttributeValues: { ":topup": allocatedCredits, ":zero": 0 }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE,
                        ConditionExpression: "attribute_not_exists(id)", 
                        Item: { 
                          __typename: 'UsageRecord', 
                          id: uniqueEventId, 
                          userId: cognitoUserId, 
                          sessionId: 'system-billing', 
                          sessionTitle: 'One-Time Credit Top-Up', 
                          actionType: 'TOP_UP', 
                          creditsUsed: allocatedCredits, 
                          monetaryValue: monetaryValue,     
                          stripeInvoiceId: invoiceId,       
                          createdAt: now 
                        }
                    }
                }
            ]
        }));
        console.log(`[TRACE] SUCCESS: DynamoDB transaction completed for TOP_UP payment.`);
      }
    } 
    
    else if (stripeEvent.type === 'invoice.payment_failed') {
      const invoice = stripeEvent.data.object as any;
      let cognitoUserId = invoice.parent?.subscription_details?.metadata?.cognitoUserId || invoice.lines?.data?.[0]?.metadata?.cognitoUserId;

      if (cognitoUserId) {
          const userProfileId = await getProfileId(cognitoUserId);
          await dynamodb.send(new UpdateCommand({
              TableName: USER_PROFILES_TABLE,
              Key: { id: userProfileId },
              UpdateExpression: "SET subscriptionStatus = :status",
              ExpressionAttributeValues: { ":status": "PAST_DUE" }
          }));
          console.log(`[TRACE] SUCCESS: Updated user profile to PAST_DUE.`);
      }
    } 
 
    else if (stripeEvent.type === 'customer.subscription.updated') {
      const subscription = stripeEvent.data.object as any;
      const cognitoUserId = subscription.metadata?.cognitoUserId;
      
      if (cognitoUserId) {
        const priceId = subscription.items?.data?.[0]?.price?.id 
                     || subscription.items?.data?.[0]?.plan?.id
                     || subscription.items?.data?.[0]?.pricing?.price_details?.price
                     || '';
                     
        const rawPeriodEnd = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end;
        const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : new Date().toISOString();
        
        const status = subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE';

        let planName = "VANGUARD";
        let newMaxCredits = 16400000;

        if (priceId === process.env.VANGUARD_ELITE_PRICE_ID) {
          planName = "VANGUARD_ELITE";
          newMaxCredits = 40000000;
        }

        try {
          const userProfileId = await getProfileId(cognitoUserId);
          await dynamodb.send(new UpdateCommand({
            TableName: USER_PROFILES_TABLE,
            Key: { id: userProfileId },
            UpdateExpression: "SET planName = :plan, subscriptionStatus = :status, currentPeriodEnd = :periodEnd, maxCredits = :max",
            ConditionExpression: "attribute_not_exists(maxCredits) OR :max > maxCredits",
            ExpressionAttributeValues: {
              ":plan": planName,
              ":status": status,
              ":periodEnd": periodEnd,
              ":max": newMaxCredits
            }
          }));
          console.log(`[TRACE] SUCCESS: Updated user profile subscription status.`);
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            console.log(`[TRACE] Mid-cycle downgrade detected for ${cognitoUserId}. Preserving current higher tier until period ends.`);
          } else {
            throw error; 
          }
        }
      }
    }

    else if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object as any;
      const cognitoUserId = subscription.metadata?.cognitoUserId;

      if (cognitoUserId) {
          const userProfileId = await getProfileId(cognitoUserId);
          await dynamodb.send(new UpdateCommand({
              TableName: USER_PROFILES_TABLE,
              Key: { id: userProfileId },
              UpdateExpression: "SET subscriptionStatus = :status, planName = :plan",
              ExpressionAttributeValues: { 
                  ":status": "CANCELED",
                  ":plan": "NONE" 
              }
          }));
          console.log(`[TRACE] SUCCESS: Processed subscription cancellation.`);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
        console.warn(`[TRACE] Idempotent retry detected for event ${stripeEvent.id}. Ignored.`);
        return { statusCode: 200, body: JSON.stringify({ received: true, note: 'Idempotent retry ignored' }) };
    }
    console.error("[TRACE] FATAL Webhook processing error:", error);
    return { statusCode: 500, body: error.message };
  }
};