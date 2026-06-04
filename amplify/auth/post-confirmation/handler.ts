import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const command = new AdminAddUserToGroupCommand({
    GroupName: 'user',
    UserPoolId: event.userPoolId,
    Username: event.userName,
  });

  try {
    await client.send(command);
    console.log(`Successfully added ${event.userName} to 'user' cognito pool group.`);
  } catch (error) {
    console.error(`Failed to add user to cognito pool group:`, error);
  }

  return event;
};