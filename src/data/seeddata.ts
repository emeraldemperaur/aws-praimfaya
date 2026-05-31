import type { ConsoleTerminal } from "./consoleterminal";
import type { ContextProfile } from "./contextprofile";
import type { FoundationModel } from "./foundationmodel";
import type { VectorCollection } from "./vectorcollection";

export const seedDataVectorCollections: VectorCollection[] = [
    {
      id: '1',
      name: 'John Doe',
      description: 'Software Engineer',
      embeddingModel: 'Amazon Bedrock',
      vectorDimension: 128,
      createdAt: '2024-01-15T10:00:00Z',
      profiles: [
        {
          id: '1',
          name: 'Project Alpha',
          description: 'A top secret project about building an AI assistant.',
          systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
          llmModelId: 'gpt-4',
          temperature: 0.7,
          isActive: true,
          vectorCollectionId: '1',
          createdBy: 'John Doe',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-02-20T14:30:00Z'
        }
      ],
      documents: [
        { 
          id: 'doc_1', 
          name: 'employee_handbook_2026.pdf', 
          size: '2.4 MB',                     
          status: 'Indexed',                  
          collectionId: 'mock-uuid-9876-5432', 
          textContent: 'The employee handbook for the year 2026.' 
        },
        { 
          id: 'doc_2', 
          name: 'Architecture_Diagram.md',    
          size: '15 KB',                      
          status: 'Indexed',                  
          collectionId: 'mock-uuid-1234-5678', 
          textContent: 'A diagram showing the system architecture.' 
        }
      ]
    },
    {
      id: '2',
      name: 'Project Beta DB',
      description: 'Another secret project vector database.',
      embeddingModel: 'OpenAI Embeddings', 
      vectorDimension: 1536,
      createdAt: '2024-02-01T12:00:00Z',
      profiles: [
        {
          id: '2',
          name: 'Project Beta',
          description: 'Another secret project about building an AI assistant.',
          systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
          llmModelId: 'gpt-4',
          temperature: 0.7,
          isActive: true,
          vectorCollectionId: '2',
          createdBy: 'John Doe',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-02-20T14:30:00Z'
        }
      ],
      documents: [
        { 
          id: 'doc_1', 
          name: 'employee_handbook_2027.pdf', 
          size: '2.4 MB',                     
          status: 'Indexed',                  
          collectionId: 'mock-uuid-9876-5432', 
          textContent: 'The employee handbook for the year 2027.' 
        },
        { 
          id: 'doc_2', 
          name: 'Monolithic_Architecture_Diagram.md',    
          size: '15 KB',                      
          status: 'Indexed',                  
          collectionId: 'mock-uuid-1234-5678', 
          textContent: 'A diagram showing the monolithic system design.' 
        }
      ]
    }
  ];


export const seedDataContextProfiles: ContextProfile[] = [
        {
          id: '1',
          name: 'John Doe',
          description: 'Software Engineer',
          systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
          llmModelId : 'Amazon Bedrock',
          vectorCollectionId: '123456789',
          vectorCollection: {
              id: '1',
              name: 'John Doe',
              description: 'Software Engineer',
              embeddingModel: 'Amazon Bedrock',
              vectorDimension: 128,
              createdAt: '2024-01-15T10:00:00Z',
              profiles: [
                {
                  id: '1',
                  name: 'Project Alpha',
                  description: 'A top secret project about building an AI assistant.',
                  systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
                  llmModelId: 'gpt-4',
                  temperature: 0.7,
                  isActive: true,
                  vectorCollectionId: '1',
                  createdBy: 'John Doe',
                  createdAt: '2024-01-15T10:00:00Z',
                  updatedAt: '2024-02-20T14:30:00Z'
                }
              ],
              documents: []
            },
          temperature: 1.0,
          isActive: true,
          createdBy: 'John Doe',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-02-20T14:30:00Z'
        },
        {
          id: '2',
          name: 'Project Beta DB',
          description: 'Another secret project vector database.',
          systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
          llmModelId : 'anthropic claude',
          vectorCollectionId: '987654321',
          vectorCollection: {
            id: '1',
              name: 'John Doe',
              description: 'Software Engineer',
              embeddingModel: 'Amazon Bedrock',
              vectorDimension: 128,
              createdAt: '2024-01-15T10:00:00Z',
              profiles: [
                {
                  id: '1',
                  name: 'Project Alpha',
                  description: 'A top secret project about building an AI assistant.',
                  systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
                  llmModelId: 'gpt-4',
                  temperature: 0.7,
                  isActive: true,
                  vectorCollectionId: '1',
                  createdBy: 'John Doe',
                  createdAt: '2024-01-15T10:00:00Z',
                  updatedAt: '2024-02-20T14:30:00Z'
                }
              ],
              documents: []
          },
          temperature: 1.0,
          isActive: true,
          createdBy: 'John Doe',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-02-20T14:30:00Z'
        }
      ];
    
export const seedDataFoundationModels: FoundationModel[] = [
      {
        id: '1',
        name: 'Amazon Nova',
        provider: 'AMAZON',
        modality: 'TEXT',
        apiIdentifier: 'amazon-text-001',
        contextWindowTokens: 10000,
        isActive: true,
        profiles: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-02-20T14:30:00Z'
      },
      {
        id: '2',
        name: 'Anthropic Claude',
        provider: 'ANTHROPIC',
        modality: 'MULTIMODAL',
        apiIdentifier: 'anthropic-multimodal-001',
        contextWindowTokens: 20000,
        isActive: false,
        profiles: [
          {
            id: '2',
            name: 'Project Beta',
            description: 'Another secret project about building an AI assistant.',
            systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
            llmModelId: 'gpt-4',
            temperature: 0.7,
            isActive: true,
            vectorCollectionId: '2',
            createdBy: 'John Doe',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-02-20T14:30:00Z'
          }
        ],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-02-20T14:30:00Z'
      }
    ];


export const seedDataConsoleTerminals: ConsoleTerminal[] = [
  {
    sessionId: 'uuid-1234-abcd-5678-efgh',
    userId: 'user1',
    contextProfileId: 'context1',
    contextProfile: {
      id: 'context1',
      name: 'Project Alpha',
      description: 'A secret project about building an AI assistant.',
      systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
      llmModelId: 'amazon-nova-pro-v1:0',
      temperature: 0.7,
      isActive: true,
      vectorCollectionId: '1',
      createdBy: 'John Doe',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-02-20T14:30:00Z'
    },
    title: 'Project Alpha Planning',
    messages: [
      {
        id: 'msg_001',
        role: 'SYSTEM',
        content: 'Context Profile loaded. RAG Collection "Project Alpha Docs" connected.',
        timestamp: '2024-02-20T14:00:00Z'
      },
      {
        id: 'msg_002',
        role: 'USER',
        content: 'Can you summarize the core deliverables for Phase 1 of Project Alpha?',
        timestamp: '2024-02-20T14:02:15Z'
      },
      {
        id: 'msg_003',
        role: 'ASSISTANT',
        content: 'Based on the project charter, Phase 1 includes three core deliverables:\n\n1. Requirements gathering and stakeholder sign-off.\n2. UI/UX wireframes for the terminal interface.\n3. Initial database schema design for the vector embeddings.',
        contextSources: ['alpha_project_charter_v2.pdf', 'Q1_roadmap.md'],
        timestamp: '2024-02-20T14:02:30Z'
      },
      {
        id: 'msg_004',
        role: 'USER',
        content: 'Perfect. Who is the lead engineer assigned to the database schema task?',
        timestamp: '2024-02-20T14:05:10Z'
      },
      {
        id: 'msg_005',
        role: 'ASSISTANT',
        content: 'According to the team resource allocation document, Sarah Jenkins is the lead engineer responsible for the database schema design.',
        contextSources: ['team_allocation_2024.xlsx'],
        timestamp: '2024-02-20T14:05:22Z'
      }
    ],
    totalTokensUsed: 1450,
    status: 'ACTIVE',
    createdAt: '2024-02-20T14:00:00Z',
    updatedAt: '2024-02-20T14:05:22Z'
  },
  {
    sessionId: 'uuid-5678-efgh-1234-abcd',
    userId: 'user2',
    contextProfileId: 'context2',
    contextProfile: {
      id: 'context2',
      name: 'Project Beta',
      description: 'A secret project about building an AI assistant.',
      systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
      llmModelId: 'openai-gpt-4',
      temperature: 0.7,
      isActive: true,
      vectorCollectionId: '2',
      createdBy: 'John Doe',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-02-18T09:15:00Z'
    },
    title: 'Beta Budget Review',
    messages: [
      {
        id: 'msg_006',
        role: 'USER',
        content: 'What was the final budget approved for Project Beta?',
        timestamp: '2024-02-18T09:10:00Z'
      },
      {
        id: 'msg_007',
        role: 'ASSISTANT',
        content: 'The final approved budget for Project Beta is $150,000 for Q1 and Q2. This includes $50,000 allocated specifically for LLM API costs and cloud infrastructure.',
        contextSources: ['beta_budget_approval_signed.pdf'],
        timestamp: '2024-02-18T09:10:18Z'
      },
      {
        id: 'msg_008',
        role: 'USER',
        content: 'Thanks, mark the budget review task as complete in the tracking system.',
        timestamp: '2024-02-18T09:12:45Z'
      },
      {
        id: 'msg_009',
        role: 'ASSISTANT',
        content: 'I have successfully updated the project board. The task "Q1 Budget Review" has been marked as complete.',
        timestamp: '2024-02-18T09:13:02Z'
      },
      {
        id: 'msg_010',
        role: 'SYSTEM',
        content: 'Session archived by administrator.',
        timestamp: '2024-02-18T09:15:00Z'
      }
    ],
    totalTokensUsed: 890,
    status: 'ARCHIVED',
    createdAt: '2024-02-18T09:10:00Z',
    updatedAt: '2024-02-18T09:15:00Z'
  },
];

export const availableProfiles: ContextProfile[] = [
    {
      id: 'cp_1',
      name: 'Senior Cloud Architect',
      description: 'Expert in AWS infrastructure, Terraform, and scaling.',
      systemPrompt: 'You are a Senior AWS Cloud Architect. Provide secure, highly available, and scalable architectural recommendations. Always consider cost optimization and the AWS Well-Architected Framework.',
      vectorCollectionId: 'vc_aws_docs',
      vectorCollection: {
      id: '3',
      name: 'vc_aws_docs',
      description: 'Software Engineer',
      embeddingModel: 'Amazon Bedrock',
      vectorDimension: 128,
      createdAt: '2024-01-15T10:00:00Z',
      profiles: [
        {
          id: '1',
          name: 'Project Alpha',
          description: 'A top secret project about building an AI assistant.',
          systemPrompt: 'You are an AI assistant designed to help with project management tasks.',
          llmModelId: 'gpt-4',
          temperature: 0.7,
          isActive: true,
          vectorCollectionId: '1',
          createdBy: 'John Doe',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-02-20T14:30:00Z'
        }
      ],
      documents: []},
      llmModelId: 'amazon.nova-pro-v1:0',
      temperature: 0.3,
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 'cp_2',
      name: 'Creative Writing Assistant',
      description: 'Helps brainstorm and draft copy, emails, and stories.',
      systemPrompt: 'You are a creative writing assistant. Be imaginative, use engaging vocabulary, and help the user overcome writer\'s block. Maintain a friendly and encouraging tone.',
      llmModelId: 'anthropic.claude-3-sonnet',
      temperature: 0.8,
      isActive: true,
      createdAt: '2024-01-20T14:30:00Z'
    }
  ];