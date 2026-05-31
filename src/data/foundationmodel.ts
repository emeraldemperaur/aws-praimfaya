import type { ContextProfile } from "./contextprofile";

export type ModelProviders = 
  | 'AMAZON' 
  | 'ANTHROPIC' 
  | 'META' 
  | 'GOOGLE' 
  | 'OPENAI' 
  | 'COHERE' 
  | 'MISTRAL';

export type ModelModality = 
  | 'TEXT' 
  | 'MULTIMODAL' 
  | 'EMBEDDING' 
  | 'IMAGE';

export interface FoundationModel {
  id: string;
  provider?: ModelProviders | null;
  name: string;
  apiIdentifier: string;
  modality?: ModelModality | null;
  contextWindowTokens?: number | null;
  isActive?: boolean | null;
  profiles?: ContextProfile[]; 
  createdAt?: string;
  updatedAt?: string;
}