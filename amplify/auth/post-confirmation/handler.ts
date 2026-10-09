import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const cognito = new CognitoIdentityProviderClient();
const ses = new SESClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const groupCommand = new AdminAddUserToGroupCommand({
    GroupName: 'user',
    UserPoolId: event.userPoolId,
    Username: event.userName,
  });

  try {
    await cognito.send(groupCommand);
    console.log(`Successfully added ${event.userName} to 'user' cognito pool group.`);
  } catch (error) {
    console.error(`Failed to add user to cognito pool group:`, error);
  }

  const email = event.request.userAttributes.email;
  const fromAddress = process.env.SES_FROM_EMAIL;

  if (email && fromAddress) {
    const emailPrefix = email.split('@')[0];

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
              .header { background-color: #0f172a; padding: 32px 24px; text-align: center; color: white; }
              .content { padding: 40px 32px; color: #334155; line-height: 1.6; font-size: 16px; }
              .btn { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 24px; }
              .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1 style="margin:0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Welcome to Praimfaya</h1>
              </div>
              <div class="content">
                  <!-- Greeting using the email prefix -->
                  <p style="margin-top: 0; font-size: 18px; font-weight: 600;">Hello ${emailPrefix},</p>
                  <p>We are thrilled to welcome you to the platform. Your account has been successfully verified and provisioned.</p>
                  <p>As a next step, we recommend logging into your workspace to complete your profile and explore the platform's core capabilities.</p>
                  <a href="https://praimfaya.com/dashboard" class="btn">Complete Your Profile</a>
                  <p style="margin-top: 32px; font-size: 14px; color: #64748b;">If you have any questions or need onboarding assistance, our support team is standing by.</p>
                  <p style="margin-bottom: 0;">Best regards,<br><strong style="color: #0f172a;">The Praimfaya Team</strong></p>
              </div>
              <div class="footer">
                  &copy; ${new Date().getFullYear()} BUILD by ME. All rights reserved.<br>
                  You are receiving this email because ${email} recently verified an account.
              </div>
          </div>
      </body>
      </html>
    `;

    try {
      await ses.send(new SendEmailCommand({
        Source: fromAddress,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: "Welcome to Praimfaya" },
          Body: { Html: { Data: htmlBody } }
        }
      }));
      console.log(`Successfully sent welcome email to ${email}`);
    } catch (error) {
      console.error(`Failed to send welcome email to ${email}:`, error);
    }
  } else {
    console.warn("Skipping welcome email: missing email address or SES_FROM_EMAIL environment variable.");
  }

  return event;
};