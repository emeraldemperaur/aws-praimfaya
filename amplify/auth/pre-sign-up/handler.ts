import type { PreSignUpTriggerHandler } from 'aws-lambda';

export const handler: PreSignUpTriggerHandler = async (event) => {
  const email = event.request.userAttributes.email;
  
  const ALLOWED_DOMAINS = [
    'praimfaya.com', 'mekaegwim.ca', 'gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com',
    'protonmail.com', 'zoho.com', 'aol.com', 'mail.com', 'ethereal.email'
  ];

  const isAllowed = email && ALLOWED_DOMAINS.some(domain => email.endsWith(`@${domain}`));

  if (!isAllowed) {
    throw new Error(`Access Denied: You must use an approved email address to access Praimfaya.`);
  }

  return event;
};