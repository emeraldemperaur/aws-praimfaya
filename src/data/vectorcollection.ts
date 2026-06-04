import type { ContextProfile } from "./contextprofile";

export interface VectorCollection {
  id?: string;
  name: string;
  description?: string | null;
  embeddingModel: string;
  vectorDimension: number;
  profiles?: ContextProfile[]; 
  documents?: VectorDocument[];
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface VectorDocument {
  id: string;
  name?: string;
  collectionId: string;
  textContent: string;
  sourceMetadata?: Record<string, unknown> | null; 
  externalVectorId?: string | null;
  collection?: VectorCollection;
  createdAt?: string;
  updatedAt?: string;
  size?: string;
  status?: string;
}

export interface UIVectorCollection {
  id?: string;
  name: string;
  description?: string | null;
  embeddingModel: string;
  vectorDimension: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profiles?: any[] | null; 
  documents?: any[] | null;
}