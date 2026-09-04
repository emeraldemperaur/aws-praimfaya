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
  description?: string;
  caliber?: string;
  region?: string;
  isActive?: boolean | null;
  profiles?: ContextProfile[]; 
  createdAt?: string;
  updatedAt?: string;
}

export interface UIFoundationModel {
  id?: string;
  name: string;
  provider: string;
  apiIdentifier: string;
  modality: string;
  contextWindowTokens?: number | null;
  description?: string;
  caliber?: string;
  region?: string;
  isActive?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
  profiles?: any[] | null; 
}