import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

export const handler = async (event: any) => {
    const { targetCognitoUserId, creditAmount } = event.arguments;

    try {
        await dynamodb.send(new UpdateCommand({
            TableName: process.env.USER_PROFILES_TABLE_NAME!,
            Key: { cognitoUserId: targetCognitoUserId },
            UpdateExpression: "SET computeCredits = computeCredits + :promo, maxCredits = maxCredits + :promo",
            ExpressionAttributeValues: { ":promo": creditAmount }
        }));
        return true;
    } catch (error: any) {
        console.error("Failed to grant promo credits:", error);
        throw new Error("Database update failed.");
    }
};