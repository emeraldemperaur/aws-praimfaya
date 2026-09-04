import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const rawDynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(rawDynamoClient);

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE_NAME!;

export const handler = async (event: any) => {
    const { targetCognitoUserId, creditAmount } = event.arguments || {};
    const adminUserId = event.identity?.claims?.sub || event.identity?.username || 'system-admin';

    if (!targetCognitoUserId || typeof creditAmount !== 'number' || creditAmount === 0) {
        throw new Error("Invalid parameters: targetCognitoUserId is required and creditAmount cannot be zero.");
    }

    const recordId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const isDeduction = creditAmount < 0;
    const sessionTitle = isDeduction 
        ? `Promotional Credits Deduction (${adminUserId})` 
        : `Promotional Credits by Admin (${adminUserId})`;

    try {
        // Atomic Transaction: Update User Profile & Record Ledger
        await dynamodb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: USER_PROFILES_TABLE,
                        Key: { cognitoUserId: targetCognitoUserId },
                        UpdateExpression: "SET computeCredits = if_not_exists(computeCredits, :zero) + :promo, maxCredits = if_not_exists(maxCredits, :zero) + :promo",
                        ExpressionAttributeValues: {
                            ":promo": creditAmount,
                            ":zero": 0
                        }
                    }
                },
                {
                    Put: {
                        TableName: USAGE_RECORDS_TABLE,
                        Item: {
                            id: recordId,
                            userId: targetCognitoUserId,
                            sessionId: 'admin-manual-adjustment',
                            sessionTitle: sessionTitle,
                            actionType: 'TOP_UP', 
                            modelId: 'N/A',
                            toolName: 'N/A',
                            creditsUsed: -creditAmount, 
                            inputTokens: 0,
                            outputTokens: 0,
                            createdAt: now
                        }
                    }
                }
            ]
        }));

        return true;
    } catch (error: any) {
        console.error(`Failed to adjust ${creditAmount} credits for user ${targetCognitoUserId}:`, error);
        throw new Error(`Database update failed: ${error.message}`);
    }
};