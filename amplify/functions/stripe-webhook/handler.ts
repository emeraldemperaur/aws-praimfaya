import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

const getProfileId = async (cognitoUserId: string): Promise<string> => {
  console.log(`[TRACE] Querying DynamoDB for UserProfile with cognitoUserId: ${cognitoUserId}`);
  const query = await dynamodb.send(new QueryCommand({
      TableName: USER_PROFILES_TABLE,
      IndexName: "byCognitoId",
      KeyConditionExpression: "cognitoUserId = :uid",
      ExpressionAttributeValues: { ":uid": cognitoUserId }
  }));
  
  if (!query.Items || query.Items.length === 0) {
      throw new Error(`No UserProfile found in database for cognitoUserId: ${cognitoUserId}`);
  }
  console.log(`[TRACE] Found database primary ID: ${query.Items[0].id}`);
  return query.Items[0].id;
};

export const handler = async (event: any) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    console.log(`[TRACE] --------------------------------------------------`);
    console.log(`[TRACE] INCOMING STRIPE EVENT: ${stripeEvent.type} (ID: ${stripeEvent.id})`);
  } catch (err: any) {
    console.error(`[TRACE] Signature verification failed: ${err.message}`);
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
            console.log(`[TRACE] EXIT: checkout.session.completed detected for a subscription. Delegating safely to invoice.paid.`);
            return { statusCode: 200, body: JSON.stringify({ received: true, note: 'Delegated to invoice.paid' }) };
        }

        cognitoUserId = session.client_reference_id!;
        customerId = session.customer as string;
        mode = session.mode;
        monetaryValue = (session.amount_total || 0) / 100;
        invoiceId = (session.invoice as string) || `cs_${session.id}`;
        priceId = process.env.TOP_UP_PRICE_ID!;
        console.log(`[TRACE] Parsed Checkout Session. Mode: ${mode}, Price: ${priceId}`);

      } else if (stripeEvent.type === 'invoice.paid') {
        const invoice = stripeEvent.data.object as Stripe.Invoice;
        customerId = invoice.customer as string;
        mode = 'subscription';
        monetaryValue = (invoice.amount_paid || 0) / 100;
        invoiceId = invoice.id;
        
        const lineItem = invoice.lines.data[0] as any;
        priceId = lineItem.price?.id || lineItem.plan?.id || (typeof lineItem.price === 'string' ? lineItem.price : '');
        console.log(`[TRACE] Parsed Invoice. Price ID detected: ${priceId}`);
        
        let subscriptionObj = (invoice as any).subscription;
        let subscriptionId = '';

        if (subscriptionObj) {
          if (typeof subscriptionObj === 'string') {
            subscriptionId = subscriptionObj;
            console.log(`[TRACE] Fetching subscription ${subscriptionId} from Stripe API to recover metadata...`);
            try {
              const fetchedSub = await stripe.subscriptions.retrieve(subscriptionId);
              cognitoUserId = fetchedSub.metadata?.cognitoUserId as string;
            } catch (e) {
              console.error(`[TRACE] Failed to retrieve subscription ${subscriptionId}`);
            }
          } else if (typeof subscriptionObj === 'object' && subscriptionObj.id) {
            subscriptionId = subscriptionObj.id;
            cognitoUserId = subscriptionObj.metadata?.cognitoUserId as string;
          }
        }

        if (!subscriptionId) {
          console.log(`[TRACE] EXIT: Ignored non-subscription invoice.`);
          return { statusCode: 200, body: JSON.stringify({ note: "Ignored non-subscription invoice." }) };
        }

        if (!cognitoUserId && subscriptionId) {
          console.log(`[TRACE] Metadata missing. Attempting deep fallback recovery via Checkout Sessions...`);
          try {
            const sessions = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 1 });
            if (sessions.data.length > 0 && sessions.data[0].client_reference_id) {
              cognitoUserId = sessions.data[0].client_reference_id;
              await stripe.subscriptions.update(subscriptionId, { metadata: { cognitoUserId } });
              console.log(`[TRACE] Auto-healed subscription ${subscriptionId} with recovered cognitoUserId: ${cognitoUserId}`);
            }
          } catch (e) {
            console.warn(`[TRACE] Failed deep fallback recovery.`);
          }
        }

        if (!cognitoUserId) {
          console.error(`[TRACE] EXIT: FATAL Missing cognitoUserId metadata for invoice: ${invoiceId}`);
          return { statusCode: 200, body: "Ignored unrecognized user." };
        }

        console.log(`[TRACE] Final resolved Cognito ID: ${cognitoUserId}`);
        periodEnd = new Date((invoice.lines.data[0].period.end) * 1000).toISOString();
      }

      let planName = "VANGUARD";
      let allocatedCredits = 16400000;

      console.log(`[TRACE] Matching Price ID (${priceId}) to Environment Secrets...`);
      console.log(`[TRACE] ENV Vanguard: ${process.env.VANGUARD_PRICE_ID} | ENV Elite: ${process.env.VANGUARD_ELITE_PRICE_ID} | ENV TopUp: ${process.env.TOP_UP_PRICE_ID}`);

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
        console.warn(`[TRACE] EXIT: Ignored unrecognized Stripe Price ID: ${priceId}`);
        return { statusCode: 200, body: "Ignored unrecognized price." };
      }

      console.log(`[TRACE] Plan Matched: ${planName}. Proceeding to DynamoDB lookup.`);

      const now = new Date().toISOString();
      const uniqueEventId = stripeEvent.id; 

      const userProfileId = await getProfileId(cognitoUserId);
      console.log(`[TRACE] Executing DynamoDB TransactWriteCommand for Profile: ${userProfileId}`);

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
      
      console.log(`[TRACE] SUCCESS: DynamoDB transaction completed.`);

    } else {
      console.log(`[TRACE] EXIT: Unhandled event type: ${stripeEvent.type}. Ignoring safely.`);
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