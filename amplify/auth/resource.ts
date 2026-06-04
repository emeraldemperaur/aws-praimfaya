import { defineAuth } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
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
