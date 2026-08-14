import type { ConsoleTerminal } from "./consoleterminal";
import type { VectorCollection } from "./vectorcollection";

export interface ContextProfile {
  id?: string;
  name: string;
  description?: string | null;            
  systemPrompt: string;
  vectorCollectionId?: string | null;    
  vectorCollection?: VectorCollection | null; 
  llmModelId: string;
  foundationModel?: any | null;  
  temperature?: number | null;           
  createdBy?: string | null;              
  isActive?: boolean | null;           
  terminals?: ConsoleTerminal[] | null; 
  role?: 'STANDARD' | 'SUPERVISOR' | 'COLLABORATOR' | string | null;
  supervisorId?: string | null;
  enableCodeInterpreter?: boolean | null;
  enableWebSearch?: boolean | null;
  enableMitoMcp?: boolean | null;
  enableApotheosisMcp?: boolean | null;
  customMcpUrl?: string | null;
  workflows?: any[] | null; 
  collaborators?: any[] | null; 

  createdAt: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface UIContextProfile {
  id?: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  vectorCollectionId?: string | null;
  llmModelId: string;
  foundationModel?: any | null;  
  temperature?: number | null;
  createdBy?: string | null;
  isActive?: boolean | null;
  terminals?: ConsoleTerminal[] | null; 
  role?: 'STANDARD' | 'SUPERVISOR' | 'COLLABORATOR' | string | null;
  supervisorId?: string | null;
  enableCodeInterpreter?: boolean | null;
  enableWebSearch?: boolean | null;
  enableMitoMcp?: boolean | null;
  enableApotheosisMcp?: boolean | null;
  customMcpUrl?: string | null;
  workflows?: any[] | null; 
  collaborators?: any[] | null; 

  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  vectorCollection?: {
    id?: string;
    name: string;
    embeddingModel: string;
    vectorDimension: number;
  } | null;
}