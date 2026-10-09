import { defineAuth } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Praimfaya - Verification Code',
      verificationEmailBody: (createCode) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
                .header { background-color: #0f172a; padding: 32px 24px; text-align: center; color: white; }
                .content { padding: 40px 32px; color: #334155; line-height: 1.6; font-size: 16px; }
                .code-box { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0; }
                .code { font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: 4px; }
                .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin:0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Security Verification</h1>
                </div>
                <div class="content">
                    <p style="margin-top: 0; font-size: 18px; font-weight: 600;">Action Required</p>
                    <p>You recently initiated a request to create a new Praimfaya account. To complete the registration process, please enter the following verification code:</p>
                    
                    <div class="code-box">
                        <span class="code">${createCode()}</span>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">This code is valid for the next 24 hours. If you did not request this verification, you can safely ignore this email.</p>
                    <p style="margin-bottom: 0;">Best regards,<br><strong style="color: #0f172a;">The Praimfaya Security Team</strong></p>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} BUILD by ME. All rights reserved.
                </div>
            </div>
        </body>
        </html>
      `
    },
  },
  groups: ['superadmin', 'root', 'admin', 'heda', 'user', 'guest'],
  triggers: {
    preSignUp: preSignUp,
    postConfirmation: postConfirmation
  },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup'])
  ],
});