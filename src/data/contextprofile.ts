export interface ContextProfile {
    id: string;                      // Unique UUID
    name: string;                    // e.g., "Apotheosis Design System" or "HR Policies"
    description: string;             // Brief overview of what this profile knows
    systemPrompt: string;            // The core instructions given to the Bedrock LLM
    vectorCollectionId: string;      // The ID connecting to your specific Vector DB (e.g., Pinecone/OpenSearch index)
    llmModelId: string;              // e.g., "anthropic.claude-3-sonnet"
    temperature: number;             // LLM creativity parameter (0.0 to 1.0)
    createdBy: string;               // User ID of the creator
    isActive: boolean;               // Soft delete/disable flag
    createdAt: string;               // ISO Timestamp
    updatedAt: string;               // ISO Timestamp
}