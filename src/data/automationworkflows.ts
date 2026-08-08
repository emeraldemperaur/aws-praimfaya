export type AutomationTool = 'N8N' | 'ZAPIER' | 'MAKE' | 'PIPEDREAM';

export interface WorkflowParameter {
  variable: string;
  isRequired: boolean;
}

export interface AutomationWorkflow {
  id: string; 
  name: string;
  description?: string | null;
  tool: AutomationTool;
  triggerURL: string;
  callbackURL?: string | null;
  inputParameters?: WorkflowParameter[] | null;
  outputVariables?: WorkflowParameter[] | null;
  pingSuccess?: boolean | null;
  archived?: boolean | null;
  vectorFactor?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profiles?: any[] | null;
}

export interface UIAutomationWorkflow {
  id?: string; 
  name: string;
  description: string;
  tool: AutomationTool | ''; 
  triggerURL: string;
  callbackURL: string;
  inputParameters: WorkflowParameter[];
  outputVariables: WorkflowParameter[];
  pingSuccess: boolean | null;
  archived: boolean;
  vectorFactor: number | string; 
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isPinging?: boolean;
  isSaving?: boolean;
  profiles?: any[];
}