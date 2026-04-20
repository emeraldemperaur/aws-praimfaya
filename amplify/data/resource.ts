import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { chronos } from '../functions/chronos/resource';

const headerRBAC = (allow: any) => [
  allow.owner(),
  allow.groups(['superadmin', 'root', 'admin', 'heda']),
];

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
    
  Chronos: a.query()
    .arguments({ name: a.string() })
    .returns(a.string())
    .handler(a.handler.function(chronos))
    .authorization((allow) => [allow.authenticated()]),


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
    .authorization(headerRBAC),


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
    .authorization(headerRBAC),


  TerminalMessage: a
    .model({
      role: a.enum(['USER', 'ASSISTANT', 'SYSTEM']),
      content: a.string().required(),
      contextSources: a.string().array(),
      terminalId: a.id(),
      terminal: a.belongsTo('ConsoleTerminal', 'terminalId'),
    })
    .authorization(headerRBAC),

  VectorCollection: a
    .model({
      name: a.string().required(),
      description: a.string(),
      embeddingModel: a.string().required(), 
      vectorDimension: a.integer().required(), 
      profiles: a.hasMany('ContextProfile', 'vectorCollectionId'),
      documents: a.hasMany('VectorDocument', 'collectionId'),
    })
    .authorization(headerRBAC),

  VectorDocument: a
    .model({
      collectionId: a.id(),
      collection: a.belongsTo('VectorCollection', 'collectionId'),
      textContent: a.string().required(), 
      // JSON metadata (e.g., {"source": "pdf", "page": 4, "url": "..."})
      sourceMetadata: a.json(), 
      externalVectorId: a.string(), 
    })
    .authorization(headerRBAC),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});