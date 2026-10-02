import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from 'stripe';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    const cognitoUserId = event.identity?.sub;
    const frontendUrl = process.env.FRONTEND_URL || 'https://prometheus-fire.dcie4i9xtobfi.amplifyapp.com';
    
    if (!cognitoUserId) {
      throw new Error("Unauthorized: Missing user identity.");
    }

    const query = await dynamodb.send(new QueryCommand({
        TableName: USER_PROFILES_TABLE,
        IndexName: "byCognitoId",
        KeyConditionExpression: "cognitoUserId = :uid",
        ExpressionAttributeValues: { ":uid": cognitoUserId }
    }));

    if (!query.Items || query.Items.length === 0) {
        throw new Error("User profile not found in database.");
    }

    const stripeCustomerId = query.Items[0].stripeCustomerId;

    if (!stripeCustomerId) {
        throw new Error("No active Stripe subscription found for this user.");
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${frontendUrl}/user-profile?portal=returned`,
    });

    return JSON.stringify({ url: session.url });

  } catch (error: any) {
    console.error("Portal generation error:", error);
    throw new Error(error.message);
  }
};