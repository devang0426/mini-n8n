/**
 * AI Agent Workflow Builder — GraphQL & Domain Types (Phase 3)
 */

export type Role = 'owner' | 'editor' | 'viewer';

export type StepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate';

export type TriggerType =
  | 'manual'
  | 'webhook'
  | 'scheduled'
  | 'database_event';

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

export type StepRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'skipped';

export type NotificationChannel = 'in_app' | 'email' | 'webhook';
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface Organization {
  id: string;
  name: string;
  quota_limit: number;
  quota_used: number;
  quota_reset_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  role: Role;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  position: number;
  step_type: StepType;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTrigger {
  id: string;
  workflow_id: string;
  trigger_type: TriggerType;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRunSummary {
  id: string;
  status: WorkflowRunStatus;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  runs?: WorkflowRunSummary[];
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  org_id: string;
  status: WorkflowRunStatus;
  trigger_type?: string | null;
  input?: Record<string, unknown> | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  step_runs?: StepRun[];
  workflow?: Workflow;
  organization?: Organization;
}

export interface StepRun {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: StepRunStatus;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
  attempt_count: number;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
  workflow_step?: WorkflowStep;
  workflow_run?: {
    id: string;
    status: WorkflowRunStatus;
  };
}

export interface Notification {
  id: string;
  org_id: string;
  workflow_run_id?: string | null;
  step_run_id?: string | null;
  channel: NotificationChannel;
  recipient: string;
  payload: Record<string, unknown>;
  delivery_status: NotificationDeliveryStatus;
  delivered_at?: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  org_id?: string | null;
  actor_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

// Input Types for GraphQL Operations

export interface CreateWorkflowInput {
  org_id: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateWorkflowInput {
  id: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CreateWorkflowStepInput {
  workflow_id: string;
  position: number;
  step_type: StepType;
  config?: Record<string, unknown>;
}

export interface UpdateWorkflowStepInput {
  id: string;
  position?: number;
  step_type?: StepType;
  config?: Record<string, unknown>;
}

export interface CreateWorkflowTriggerInput {
  workflow_id: string;
  trigger_type: TriggerType;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface UpdateWorkflowTriggerInput {
  id: string;
  trigger_type?: TriggerType;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

// Contract Interfaces for Future Approval Action

export interface ApproveStepInput {
  workflow_run_id: string;
  step_run_id: string;
  approved: boolean;
}

export interface ApproveStepResult {
  success: boolean;
  workflow_run_id: string;
  step_run_id: string;
  status: WorkflowRunStatus;
  message?: string;
}
