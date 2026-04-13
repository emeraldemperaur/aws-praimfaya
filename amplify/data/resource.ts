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


  ContextProfile: a
    .model({
      name: a.string().required(),
      description: a.string(),
      systemPrompt: a.string().required(),
      vectorCollectionId: a.string(),
      llmModelId: a.string().required(),
      temperature: a.float(),
      createdBy: a.string(),
      isActive: a.boolean(),
      terminals: a.hasMany('ConsoleTerminal', 'contextProfileId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),


  ConsoleTerminal: a
    .model({

      userId: a.string(),
      title: a.string(),
      totalTokensUsed: a.integer(),
      status: a.enum(['ACTIVE', 'ARCHIVED']),
      contextProfileId: a.id(),
      contextProfile: a.belongsTo('ContextProfile', 'contextProfileId'),
      messages: a.hasMany('TerminalMessage', 'terminalId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),


  TerminalMessage: a
    .model({
      role: a.enum(['USER', 'ASSISTANT', 'SYSTEM']),
      content: a.string().required(),
      contextSources: a.string().array(),
      terminalId: a.id(),
      terminal: a.belongsTo('ConsoleTerminal', 'terminalId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
  },
});