import type { ConsoleTerminal } from "./consoleterminal";
import type { VectorCollection } from "./vectorcollection";

export interface ContextProfile {
  id?: string;
  name: string;
  description?: string;
  systemPrompt: string;
  vectorCollectionId?: string;
  vectorCollection?: VectorCollection; 
  llmModelId: string;
  temperature?: number;
  createdBy?: string;
  isActive?: boolean;
  terminals?: ConsoleTerminal[]; 
  createdAt: string;
  updatedAt?: string;
}