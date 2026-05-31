import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { chronos } from '../functions/chronos/resource';

const headerRBAC = (allow: any) => [
  allow.owner(),
  allow.groups(['superadmin', 'root', 'admin', 'heda']),
];

const ModelProviders = ['AMAZON', 'ANTHROPIC', 'META', 'GOOGLE', 'OPENAI', 'COHERE', 'MISTRAL'] as const;
const ModelModality = ['TEXT', 'MULTIMODAL', 'EMBEDDING', 'IMAGE'] as const;

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
      vectorCollectionId: a.id(),
      vectorCollection: a.belongsTo('VectorCollection', 'vectorCollectionId'),
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

    FoundationModel: a
    .model({
      provider: a.enum(ModelProviders),
      name: a.string().required(),
      
      // Bedrock/API Identifier String (e.g., "meta.llama3-8b-instruct-v1:0")
      apiIdentifier: a.string().required(), 
      
      modality: a.enum(ModelModality),
      contextWindowTokens: a.integer(),
      isActive: a.boolean(),

      // Relationship back to ContextProfile
      profiles: a.hasMany('ContextProfile', 'llmModelId'),
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