import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { SocialMessagingClient, SendWhatsAppMessageCommand } from '@aws-sdk/client-socialmessaging';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ToolExecutionContext } from './types';

const snsClient = new SNSClient({});
const pinpointSmsClient = new PinpointSMSVoiceV2Client({});
const socialClient = new SocialMessagingClient({});

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const MAX_MESSAGE_LENGTH = 1600; 

export const executeAwsNotificationAgent = async (ctx: ToolExecutionContext) => {
    const { toolInput, cognitoUserId } = ctx;
    
    const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME;
    const ORIGINATION_PHONE_NUMBER_ID = process.env.AWS_MESSAGE_ORIGINATION_ID;
    const WHATSAPP_ORIGINATION_ID = process.env.AWS_WHATSAPP_ORIGINATION_ID;

    try {
        const { action, channel = 'SMS', message, destinationNumber } = toolInput;

        if (action === 'SEND_MESSAGE') {
            if (!message || message.trim() === '') {
                return { error: "Message payload cannot be empty." };
            }

            const safeMessage = message.length > MAX_MESSAGE_LENGTH 
                ? `${message.substring(0, MAX_MESSAGE_LENGTH)}... [Truncated]` 
                : message;

            let targetNumber = destinationNumber;

            if (!targetNumber) {
                if (!cognitoUserId || !USER_PROFILES_TABLE) {
                    return { error: "Cannot resolve destination number. No phone number provided and user context is unavailable." };
                }

                const profileQuery = new QueryCommand({
                    TableName: USER_PROFILES_TABLE,
                    IndexName: 'byCognitoId',
                    KeyConditionExpression: 'cognitoUserId = :uid',
                    ExpressionAttributeValues: { ':uid': cognitoUserId },
                    Limit: 1
                });

                const profileData = await docClient.send(profileQuery);
                if (profileData.Items && profileData.Items.length > 0) {
                    targetNumber = profileData.Items[0].phoneNumber;
                }

                if (!targetNumber) {
                    return { error: "User profile does not have a registered E.164 phone number. Please update Account Settings." };
                }
            }

            const digitsOnly = targetNumber.replace(/\D/g, '');
            if (digitsOnly.length < 7 || digitsOnly.length > 15) {
                return { error: `Invalid phone number format. Contains ${digitsOnly.length} digits. E.164 requires 7 to 15 digits.` };
            }
            const e164Number = `+${digitsOnly}`;

            const uppercaseChannel = channel.toUpperCase();

            if (uppercaseChannel === 'WHATSAPP') {
                if (!WHATSAPP_ORIGINATION_ID) {
                    return { error: "AWS WhatsApp origination ID is not configured in backend environment." };
                }

                const whatsappMessagePayload = {
                    messaging_product: "whatsapp",
                    to: e164Number,
                    type: "text",
                    text: { body: safeMessage }
                };

                const command = new SendWhatsAppMessageCommand({
                    originationPhoneNumberId: WHATSAPP_ORIGINATION_ID,
                    metaApiVersion: "v20.0",
                    message: Buffer.from(JSON.stringify(whatsappMessagePayload))
                });

                const res = await socialClient.send(command);
                return { 
                    status: "Success", 
                    channel: "WHATSAPP", 
                    messageId: res.messageId, 
                    recipient: e164Number 
                };
            }

            if (uppercaseChannel === 'RCS') {
                if (ORIGINATION_PHONE_NUMBER_ID) {
                    const command = new SendTextMessageCommand({
                        DestinationPhoneNumber: e164Number,
                        OriginationIdentity: ORIGINATION_PHONE_NUMBER_ID,
                        MessageBody: safeMessage,
                        MessageType: "TRANSACTIONAL"
                    });

                    const res = await pinpointSmsClient.send(command);
                    return { 
                        status: "Success", 
                        channel: "RCS", 
                        messageId: res.MessageId, 
                        recipient: e164Number 
                    };
                } else {
                    console.warn(`[Notification] RCS requested but AWS_MESSAGE_ORIGINATION_ID missing. Downgrading to SNS SMS for ${e164Number}.`);
                }
            }

            const snsCommand = new PublishCommand({
                PhoneNumber: e164Number,
                Message: safeMessage,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                        DataType: 'String',
                        StringValue: 'Transactional'
                    }
                }
            });

            const snsRes = await snsClient.send(snsCommand);
            return { 
                status: "Success", 
                channel: "SMS", 
                note: uppercaseChannel === 'RCS' ? "Downgraded from RCS to SMS due to missing AWS configuration." : undefined,
                messageId: snsRes.MessageId, 
                recipient: e164Number 
            };
        }

        return { error: `Unsupported notification action: ${action}` };
    } catch (err: any) {
        console.error("AWS Notification Dispatch Error:", err);
        return { 
            error: `AWS Notification Error: ${err.message || "Failed to dispatch message"}`,
            code: err.code || err.name
        };
    }
};