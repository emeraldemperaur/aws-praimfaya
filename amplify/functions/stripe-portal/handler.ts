import Stripe from 'stripe';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' as any });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

export const handler = async (event: any) => {
  const cognitoUserId = event.identity.claims.sub;
  const frontendUrl = process.env.FRONTEND_URL || 'https://prometheus-fire.dcie4i9xtobfi.amplifyapp.com';

  const userRes = await dynamodb.send(new GetCommand({
      TableName: process.env.USER_PROFILES_TABLE_NAME!,
      Key: { cognitoUserId }
  }));

  const stripeCustomerId = userRes.Item?.stripeCustomerId;
  if (!stripeCustomerId) throw new Error("User has no active Stripe Customer ID.");

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${frontendUrl}/user-profile?portal=returned`,
  });

  return session.url;
};