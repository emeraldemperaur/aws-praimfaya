import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { SocialMessagingClient, SendWhatsAppMessageCommand } from '@aws-sdk/client-socialmessaging';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ToolExecutionContext } from './types';

let _snsClient: SNSClient;
let _pinpointClient: PinpointSMSVoiceV2Client;
let _socialClient: SocialMessagingClient;
let _sesClient: SESClient;
let _docClient: DynamoDBDocumentClient;

const getSnsClient = () => _snsClient || (_snsClient = new SNSClient({}));
const getPinpointClient = () => _pinpointClient || (_pinpointClient = new PinpointSMSVoiceV2Client({}));
const getSocialClient = () => _socialClient || (_socialClient = new SocialMessagingClient({}));
const getSesClient = () => _sesClient || (_sesClient = new SESClient({}));
const getDocClient = () => _docClient || (_docClient = DynamoDBDocumentClient.from(new DynamoDBClient({})));

const MAX_TELECOM_LENGTH = 1600;

export const executeAwsNotificationAgent = async (ctx: ToolExecutionContext) => {
    const { toolInput, cognitoUserId } = ctx;
    
    const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE_NAME;
    const ORIGINATION_PHONE_NUMBER_ID = process.env.AWS_MESSAGE_ORIGINATION_ID;
    const WHATSAPP_ORIGINATION_ID = process.env.AWS_WHATSAPP_ORIGINATION_ID;
    const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || '';

    try {
        const { action, channel = 'SMS', message, destinationNumber, destinationEmail } = toolInput;

        if (action === 'SEND_MESSAGE') {
            if (!message || message.trim() === '') {
                return { error: "Message payload cannot be empty." };
            }

            const uppercaseChannel = channel.toUpperCase();
            const isTelecom = ['SMS', 'RCS', 'WHATSAPP'].includes(uppercaseChannel);

            const safeMessage = (isTelecom && message.length > MAX_TELECOM_LENGTH) 
                ? `${message.substring(0, MAX_TELECOM_LENGTH)}... [Truncated]` 
                : message;

            const containsEmail = destinationNumber && destinationNumber.includes('@');
            let targetEmail = destinationEmail || (containsEmail ? destinationNumber : null);
            let targetNumber = !containsEmail ? destinationNumber : null;

            const needsPhoneFallback = isTelecom && !targetNumber;
            const needsEmailFallback = uppercaseChannel === 'EMAIL' && !targetEmail;
            if (needsPhoneFallback || needsEmailFallback) {
                if (!cognitoUserId || !USER_PROFILES_TABLE) {
                    return { error: `Cannot resolve destination ${uppercaseChannel === 'EMAIL' ? 'email' : 'number'}. No contact info provided and user context is unavailable.` };
                }

                const profileQuery = new QueryCommand({
                    TableName: USER_PROFILES_TABLE,
                    IndexName: 'byCognitoId',
                    KeyConditionExpression: 'cognitoUserId = :uid',
                    ExpressionAttributeValues: { ':uid': cognitoUserId },
                    Limit: 1
                });

                const profileData = await getDocClient().send(profileQuery);
                if (profileData.Items && profileData.Items.length > 0) {
                    if (needsPhoneFallback) targetNumber = profileData.Items[0].phoneNumber;
                    if (needsEmailFallback) targetEmail = profileData.Items[0].email;
                }

                if (needsPhoneFallback && !targetNumber) {
                    return { error: "User profile does not have a registered E.164 phone number. Please update Account Settings." };
                }
                if (needsEmailFallback && !targetEmail) {
                    return { error: "User profile does not have a registered email address." };
                }
            }

            if (uppercaseChannel === 'EMAIL') {
                if (!SES_FROM_EMAIL) {
                    return { error: "Email dispatch failed: AWS SES From Address is not configured." };
                }

                const command = new SendEmailCommand({
                    Source: SES_FROM_EMAIL,
                    Destination: { ToAddresses: [targetEmail] },
                    Message: {
                        Subject: { Data: "Vanguard Platform Notification" },
                        Body: { Text: { Data: safeMessage } }
                    }
                });

                const res = await getSesClient().send(command);
                return { 
                    status: "Success", 
                    channel: "EMAIL", 
                    messageId: res.MessageId, 
                    recipient: targetEmail,
                    billingMetrics: {
                        action: "AWS_SES_EMAIL",
                        creditsToDeduct: 1
                    }
                };
            }

            const digitsOnly = targetNumber!.replace(/\D/g, '');
            if (digitsOnly.length < 7 || digitsOnly.length > 15) {
                return { error: `Invalid phone number format. Contains ${digitsOnly.length} digits. E.164 requires 7 to 15 digits.` };
            }
            const e164Number = `+${digitsOnly}`;
            if (uppercaseChannel === 'WHATSAPP') {
                if (!WHATSAPP_ORIGINATION_ID) {
                    return { error: "AWS WhatsApp origination ID is not configured in backend environment." };
                }

                const command = new SendWhatsAppMessageCommand({
                    originationPhoneNumberId: WHATSAPP_ORIGINATION_ID,
                    metaApiVersion: "v20.0",
                    message: Buffer.from(JSON.stringify({
                        messaging_product: "whatsapp",
                        to: e164Number,
                        type: "text",
                        text: { body: safeMessage }
                    }))
                });

                const res = await getSocialClient().send(command);
                return { 
                    status: "Success", 
                    channel: "WHATSAPP", 
                    messageId: res.messageId, 
                    recipient: e164Number,
                    billingMetrics: {
                        action: "AWS_WHATSAPP_MESSAGE",
                        creditsToDeduct: 30 
                    }
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

                    const res = await getPinpointClient().send(command);
                    return { 
                        status: "Success", 
                        channel: "RCS", 
                        messageId: res.MessageId, 
                        recipient: e164Number,
                        billingMetrics: {
                            action: "AWS_RCS_MESSAGE",
                            creditsToDeduct: 15
                        }
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

            const snsRes = await getSnsClient().send(snsCommand);
            return { 
                status: "Success", 
                channel: "SMS", 
                note: uppercaseChannel === 'RCS' ? "Downgraded from RCS to SMS due to missing AWS configuration." : undefined,
                messageId: snsRes.MessageId, 
                recipient: e164Number,
                billingMetrics: {
                    action: "AWS_SNS_SMS",
                    creditsToDeduct: 15 
                }
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