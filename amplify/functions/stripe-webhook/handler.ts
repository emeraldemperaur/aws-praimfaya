import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const getProfileId = async (cognitoUserId: string): Promise<string> => {
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
      let monetaryValue = 0;
      let invoiceId = '';

      if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription') {
            return { statusCode: 200, body: JSON.stringify({ received: true, note: 'Delegated to invoice.paid' }) };
        }

        cognitoUserId = session.client_reference_id!;
        customerId = session.customer as string;
        mode = session.mode;
        monetaryValue = (session.amount_total || 0) / 100;
        invoiceId = (session.invoice as string) || `cs_${session.id}`;
        priceId = process.env.TOP_UP_PRICE_ID!;

      } else if (stripeEvent.type === 'invoice.paid') {
        const invoice = stripeEvent.data.object as Stripe.Invoice;
        customerId = invoice.customer as string;
        mode = 'subscription';
        monetaryValue = (invoice.amount_paid || 0) / 100;
        invoiceId = invoice.id;
        
        const lineItem = invoice.lines.data[0] as any;
        priceId = lineItem.price?.id || lineItem.plan?.id || (typeof lineItem.price === 'string' ? lineItem.price : '');
        
        let subscriptionObj = (invoice as any).subscription;
        let subscriptionId = '';

        if (subscriptionObj) {
          if (typeof subscriptionObj === 'string') {
            subscriptionId = subscriptionObj;
            try {
              const fetchedSub = await stripe.subscriptions.retrieve(subscriptionId);
              cognitoUserId = fetchedSub.metadata?.cognitoUserId as string;
            } catch (e) {
              console.error(`Failed to retrieve subscription ${subscriptionId}`);
            }
          } else if (typeof subscriptionObj === 'object' && subscriptionObj.id) {
            subscriptionId = subscriptionObj.id;
            cognitoUserId = subscriptionObj.metadata?.cognitoUserId as string;
          }
        }

        if (!subscriptionId) {
          return { statusCode: 200, body: JSON.stringify({ note: "Ignored non-subscription invoice." }) };
        }

        if (!cognitoUserId && subscriptionId) {
          try {
            const sessions = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 1 });
            if (sessions.data.length > 0 && sessions.data[0].client_reference_id) {
              cognitoUserId = sessions.data[0].client_reference_id;
              await stripe.subscriptions.update(subscriptionId, { metadata: { cognitoUserId } });
              console.log(`Auto-healed subscription ${subscriptionId} with recovered cognitoUserId`);
            }
          } catch (e) {
            console.warn(`Failed to recover cognitoUserId from checkout sessions for sub ${subscriptionId}`);
          }
        }

        if (!cognitoUserId) {
          console.error(`Missing cognitoUserId metadata for invoice: ${invoiceId}`);
          return { statusCode: 200, body: "Ignored unrecognized user." };
        }

        periodEnd = new Date((invoice.lines.data[0].period.end) * 1000).toISOString();
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
        console.warn(`Ignored unrecognized Stripe Price ID: ${priceId}`);
        return { statusCode: 200, body: "Ignored unrecognized price." };
      }

      const now = new Date().toISOString();
      const uniqueEventId = stripeEvent.id; 

      const userProfileId = await getProfileId(cognitoUserId);

      if (mode === 'subscription') {
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
                          id: uniqueEventId, 
                          userId: cognitoUserId, 
                          sessionId: 'system-billing', 
                          sessionTitle: 'Subscription Purchase/Renewal', 
                          actionType: 'TOP_UP', 
                          creditsUsed: -allocatedCredits, 
                          monetaryValue: monetaryValue,     
                          stripeInvoiceId: invoiceId,
                          createdAt: now 
                        }
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
                          id: uniqueEventId, 
                          userId: cognitoUserId, 
                          sessionId: 'system-billing', 
                          sessionTitle: 'One-Time Credit Top-Up', 
                          actionType: 'TOP_UP', 
                          creditsUsed: -allocatedCredits, 
                          monetaryValue: monetaryValue,     
                          stripeInvoiceId: invoiceId,       
                          createdAt: now 
                        }
                    }
                }
            ]
        }));
      }
    } 
    
    else if (stripeEvent.type === 'invoice.payment_failed') {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      let cognitoUserId: string | undefined;

      let subscriptionObj = (invoice as any).subscription;
      let subscriptionId = '';
      
      if (subscriptionObj) {
          if (typeof subscriptionObj === 'string') {
              subscriptionId = subscriptionObj;
              try {
                  const fetchedSub = await stripe.subscriptions.retrieve(subscriptionId);
                  cognitoUserId = fetchedSub.metadata?.cognitoUserId as string;
              } catch (e) { }
          } else if (typeof subscriptionObj === 'object' && subscriptionObj.id) {
              subscriptionId = subscriptionObj.id;
              cognitoUserId = subscriptionObj.metadata?.cognitoUserId as string;
          }
      }

      if (!cognitoUserId && subscriptionId) {
          try {
              const sessions = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 1 });
              if (sessions.data.length > 0 && sessions.data[0].client_reference_id) {
                  cognitoUserId = sessions.data[0].client_reference_id;
              }
          } catch (e) { }
      }

      if (cognitoUserId) {
          const userProfileId = await getProfileId(cognitoUserId);
          await dynamodb.send(new UpdateCommand({
              TableName: USER_PROFILES_TABLE,
              Key: { id: userProfileId },
              UpdateExpression: "SET subscriptionStatus = :status",
              ExpressionAttributeValues: { ":status": "PAST_DUE" }
          }));
      }
    } 
 
    else if (stripeEvent.type === 'customer.subscription.updated') {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      let cognitoUserId = subscription.metadata?.cognitoUserId;
      
      if (!cognitoUserId) {
          try {
              const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
              if (sessions.data.length > 0 && sessions.data[0].client_reference_id) {
                  cognitoUserId = sessions.data[0].client_reference_id;
              }
          } catch (e) {}
      }

      if (cognitoUserId) {
        const priceId = subscription.items.data[0].price.id;
        const periodEnd = new Date((subscription as any).current_period_end * 1000).toISOString();
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
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            console.log(`Mid-cycle downgrade detected for ${cognitoUserId}. Preserving current higher tier until period ends.`);
          } else {
            throw error; 
          }
        }
      }
    }

    else if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      let cognitoUserId = subscription.metadata?.cognitoUserId;

      if (!cognitoUserId) {
          try {
              const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
              if (sessions.data.length > 0 && sessions.data[0].client_reference_id) {
                  cognitoUserId = sessions.data[0].client_reference_id;
              }
          } catch (e) {}
      }

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
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
        console.warn(`Idempotent retry detected for event ${stripeEvent.id}. Ignored.`);
        return { statusCode: 200, body: JSON.stringify({ received: true, note: 'Idempotent retry ignored' }) };
    }
    console.error("Webhook processing error:", error);
    return { statusCode: 500, body: error.message };
  }
};