/**
 * AI Workflow Assistant — Type Definitions & Schemas (Phase P7)
 */

export type AllowedStepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate';

export type AllowedTriggerType = 'manual' | 'webhook';

export interface AIStepProposal {
  position: number;
  step_type: AllowedStepType;
  name?: string;
  config: Record<string, unknown>;
}

export interface AITriggerProposal {
  trigger_type: AllowedTriggerType;
  config: Record<string, unknown>;
  is_enabled: boolean;
}

export interface AIWorkflowProposal {
  name: string;
  description: string | null;
  is_active: boolean;
  triggers: AITriggerProposal[];
  steps: AIStepProposal[];
}

export interface SafeConnectionInfo {
  id: string;
  name: string;
  provider: string;
  type: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface AssistantApiResponse {
  success: boolean;
  proposal?: AIWorkflowProposal;
  error?: string;
  issues?: ValidationIssue[];
}
