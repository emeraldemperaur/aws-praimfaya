export interface ConsoleTerminal {
    sessionId: string;               // Unique UUID for this specific chat thread
    userId: string;                  // AWS Cognito User ID
    contextProfileId: string;        // Foreign key linking to the ContextProfile being used
    title: string;                   // Auto-generated or user-defined title for the chat history
    messages: TerminalMessage[];     // Array of the actual conversation
    totalTokensUsed: number;         // Tracking for AWS Bedrock billing/quotas
    status: 'ACTIVE' | 'ARCHIVED';   // State of the chat
    createdAt: string;               // ISO Timestamp
    updatedAt: string;               // ISO Timestamp
}

export interface TerminalMessage {
    id: string;                      // Message UUID
    role: 'USER' | 'ASSISTANT' | 'SYSTEM'; 
    content: string;                 // The actual text payload
    contextSources?: string[];       // Optional array of document references the RAG retrieved for this specific answer
    timestamp: string;               // ISO Timestamp
}