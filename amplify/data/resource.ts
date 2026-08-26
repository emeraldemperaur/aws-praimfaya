import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { chronos } from '../functions/chronos/resource';
import { createCheckoutSession } from '../functions/stripe-checkout/resource';
import { grantPromoCredits } from '../functions/admin-promo/resource';
import { chatHandler } from '../functions/chat-handler/resource';

const headerRBAC = (allow: any) => [
  allow.owner(),
  allow.groups(['superadmin', 'root', 'admin', 'heda']),
];

const iamRBAC = (allow: any) => [
  allow.owner(),
  allow.groups(['superadmin', 'root', 'admin', 'heda']),
  allow.authenticated('identityPool')
];

const ModelProviders = [
  'AMAZON', 'ANTHROPIC', 'META', 'GOOGLE', 'OPENAI', 
  'COHERE', 'MISTRAL', 'STABILITY', 'DEEPSEEK', 
  'LUMA', 'TWELVELABS', 'NVIDIA'
] as const;

const ModelModality = ['TEXT', 'MULTIMODAL', 'EMBEDDING', 'IMAGE'] as const;
const AutomationTools = ['N8N', 'ZAPIER', 'MAKE', 'PIPEDREAM'] as const;
const AgentRoles = ['SUPERVISOR', 'COLLABORATOR', 'STANDARD'] as const;
const ProvisioningStatus = ['READY', 'PROVISIONING', 'UNPROVISIONED', 'FAILED'] as const;

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

  askAssistant: a.query()
    .arguments({
      prompt: a.string(),
      systemPrompt: a.string(),
      modelId: a.string(),
      profileId: a.id(),
      cognitoUserId: a.string(),
      chatHistory: a.string(),
      ephemeralSecretsJson: a.string(), // SECURE SIDE CHANNEL CREDENTIAL INJECTION
    })
    .returns(a.string())
    .handler(a.handler.function(chatHandler))
    .authorization((allow) => [allow.authenticated()]),

  ContextProfile: a
    .model({
      name: a.string().required(),
      description: a.string(),
      systemPrompt: a.string().required(),
      temperature: a.float(),
      isActive: a.boolean(),
      createdBy: a.string(),
      updatedBy: a.string(),
      llmModelId: a.id().required(), 
      foundationModel: a.belongsTo('FoundationModel', 'llmModelId'), 
      vectorCollectionId: a.id(),
      vectorCollection: a.belongsTo('VectorCollection', 'vectorCollectionId'),
      enableCodeInterpreter: a.boolean().default(false),
      enableWebSearch: a.boolean().default(false),
      role: a.enum(AgentRoles),
      supervisorId: a.id(),
      supervisor: a.belongsTo('ContextProfile', 'supervisorId'),
      collaborators: a.hasMany('ContextProfile', 'supervisorId'),
      terminals: a.hasMany('ConsoleTerminal', 'contextProfileId'),
      workflows: a.hasMany('ContextProfileWorkflow', 'contextProfileId'),
      enableMitoMcp: a.boolean().default(false),
      enableApotheosisMcp: a.boolean().default(false),
      customMcpUrl: a.string(),
      mcpRequiresAuth: a.boolean(),
      mcpAuthToken: a.string(),
      awsAgentId: a.string(),
      awsAliasId: a.string(),
      lastUsedAt: a.datetime(),
      provisioningStatus: a.enum(ProvisioningStatus),
      subagentEavesdrop: a.boolean().default(false),
    })
    .authorization(headerRBAC),

  WorkflowParameter: a
    .customType({
      variable: a.string().required(),
      type: a.string(),
      isRequired: a.boolean().required(),
    }),

  AutomationTool: a.enum(AutomationTools),

  ContextWorkflow: a
    .model({
      name: a.string().required(), 
      description: a.string(),
      tool: a.ref('AutomationTool').required(),
      triggerURL: a.string().required(),
      requiresAuth: a.boolean().default(false),
      authHeader: a.string(),
      callbackURL: a.string(),
      inputParameters: a.ref('WorkflowParameter').array(),
      outputVariables: a.ref('WorkflowParameter').array(),
      pingSuccess: a.boolean(),
      archived: a.boolean().default(false),
      createdBy: a.string(),
      updatedBy: a.string(),
      vectorFactor: a.integer(),
      profiles: a.hasMany('ContextProfileWorkflow', 'contextWorkflowId'),
    })
    .authorization(headerRBAC),

  ContextProfileWorkflow: a
    .model({
      contextProfileId: a.id(),
      contextProfile: a.belongsTo('ContextProfile', 'contextProfileId'),
      
      contextWorkflowId: a.id(),
      contextWorkflow: a.belongsTo('ContextWorkflow', 'contextWorkflowId'),
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
      embeddingModel: a.string(), 
      vectorDimension: a.integer(), 
      profiles: a.hasMany('ContextProfile', 'vectorCollectionId'),
      documents: a.hasMany('VectorDocument', 'collectionId'),
      createdBy: a.string(),
      updatedBy: a.string(),
    })
    .authorization(headerRBAC),

  VectorDocument: a
    .model({
      collectionId: a.id(),
      collection: a.belongsTo('VectorCollection', 'collectionId'),
      textContent: a.string().required(), 
      sourceMetadata: a.json(), 
      externalVectorId: a.string(), 
    })
    .authorization(headerRBAC),

    RAGArtifact: a.model({
      id: a.id(),
      userId: a.string().required(),
      terminalId: a.string().required(),
      terminalTitle: a.string(),
      modelName: a.string(),
      contextProfileName: a.string(),
      contextProfileId: a.string(),
      fileName: a.string().required(),
      fileUrl: a.string().required(),
      fileType: a.enum(['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']),
      createdAt: a.datetime().required()
    })
    .authorization(headerRBAC)
    .secondaryIndexes(index => [index("userId").sortKeys(["createdAt"])]),

  FoundationModel: a
    .model({
      provider: a.enum(ModelProviders),
      name: a.string().required(),
      apiIdentifier: a.string().required(), 
      modality: a.enum(ModelModality),
      contextWindowTokens: a.integer(),
      isActive: a.boolean(),
      profiles: a.hasMany('ContextProfile', 'llmModelId'),
      updatedBy: a.string(),
    })
    .authorization(headerRBAC),
  
  UserProfile: a
    .model({
      cognitoUserId: a.string().required(),
      stripeCustomerId: a.string(),
      subscriptionStatus: a.enum(['ACTIVE', 'CANCELED', 'PAST_DUE', 'NONE']),
      planName: a.string(),
      currentPeriodEnd: a.datetime(),
      computeCredits: a.integer().default(0), 
      maxCredits: a.integer().default(0),
    })
    .authorization(iamRBAC),

  UsageRecord: a.model({
      id: a.id(),
      userId: a.string().required(),
      sessionId: a.string().required(),
      sessionTitle: a.string(),
      actionType: a.enum(['LLM_INFERENCE', 'TOOL_EXECUTION', 'TOP_UP']),
      modelId: a.string(),      
      toolName: a.string(),
      creditsUsed: a.integer().required(),
      inputTokens: a.integer(),
      outputTokens: a.integer(),
      createdAt: a.datetime().required()
    })
    .authorization(iamRBAC)
    .secondaryIndexes(index => [
      index("userId").sortKeys(["createdAt"]),
      index("sessionId").sortKeys(["createdAt"])
    ]),

  createCheckoutSession: a.mutation()
    .arguments({ planTier: a.enum(['VANGUARD', 'VANGUARD_ELITE', 'TOP_UP']) })
    .returns(a.string())
    .authorization(iamRBAC)
    .handler(a.handler.function(createCheckoutSession)),

  grantPromoCredits: a.mutation()
    .arguments({ targetCognitoUserId: a.string().required(), creditAmount: a.integer().required() })
    .returns(a.boolean())
    .authorization((allow) => [allow.groups(['superadmin', 'admin', 'root', 'heda'])])
    .handler(a.handler.function(grantPromoCredits)),

  

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});