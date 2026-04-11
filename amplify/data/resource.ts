import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { chronos } from '../functions/chronos/resource';

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
    
  Chronos: a.query()
    .arguments({ name: a.string() })
    .returns(a.string())
    .handler(a.handler.function(chronos))
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
  },
});