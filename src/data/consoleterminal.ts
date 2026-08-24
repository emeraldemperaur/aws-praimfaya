import type { ContextProfile } from "./contextprofile";

export interface ConsoleTerminal {
    sessionId: string;               // Unique UUID for this specific chat thread
    userId: string;                  // AWS Cognito User ID
    contextProfileId: string;        // Foreign key linking to the ContextProfile being used
    contextProfile?: ContextProfile;  // The actual ContextProfile object for easy access to system prompt, vector collection, etc.
    title: string;                   // Auto-generated or user-defined title for the chat history
    messages: TerminalMessage[];     // Array of the actual conversation
    totalTokensUsed: number;         // Tracking for AWS Bedrock billing/quotas
    status: 'ACTIVE' | 'ARCHIVED';   // State of the chat
    createdAt: string;               // ISO Timestamp
    updatedAt?: string;               // ISO Timestamp
    updatedBy?: string | null;        // Email or username of the last person who updated this terminal
}

export interface TerminalMessage {
    id: string;                      // Message UUID
    role: 'USER' | 'ASSISTANT' | 'SYSTEM'; 
    content: string;                 // The actual text payload
    contextSources?: string[];       // Optional array of document references the RAG retrieved for this specific answer
    timestamp: string;               // ISO Timestamp
}

export interface UIConsoleTerminal {
  id: string; 
  userId?: string | null;
  title: string;
  totalTokensUsed?: number | null;
  status: 'ACTIVE' | 'ARCHIVED';
  contextProfileId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  contextProfile?: any | null;
  messages?: any[] | null;
}

export interface EphemeralSecrets {
  airtableApiKey?: string;
  snowflakeAccount?: string;
  snowflakeUser?: string;
  snowflakePrivateKey?: string;
  airflowBaseUrl?: string;
  ripplingApiKey?: string;
  bambooSubdomain?: string;
  bambooApiKey?: string;
  zendeskSubdomain?: string;
  zendeskEmail?: string;
  zendeskToken?: string;
  serviceNowInstance?: string;
  serviceNowUser?: string;
  serviceNowPassword?: string;
  pagerDutyApiKey?: string;
  pagerDutyUserEmail?: string;
}