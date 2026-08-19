/**
 * AI Agent Workflow Builder — Server-Side Workflow Types (Phase 4A)
 */

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type StepRunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';

export type StepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate'
  | 'browser_navigate'
  | 'stagehand_act'
  | 'stagehand_extract'
  | 'stagehand_observe';

export type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'database_event';

export interface ExecutionRequest {
  workflow_id: string;
  org_id: string;
  trigger_type: TriggerType;
  input?: Record<string, unknown>;
  actor_id?: string;
}

export interface ExecutionResult {
  workflow_run_id: string;
  status: RunStatus;
  started_at?: string;
  completed_at?: string;
  output?: Record<string, unknown>;
  error?: string;
  paused_at_step_id?: string;
}

export interface StepContext {
  workflowInput: Record<string, unknown>;
  previousOutput?: Record<string, unknown>;
  stepConfig: Record<string, unknown>;
  workflowRunId: string;
  stepRunId: string;
  orgId: string;
  attemptCount: number;
}

export interface StepRunnerResult {
  status: StepRunStatus;
  output?: Record<string, unknown>;
  error?: string;
  isRetryable?: boolean;
  branchTaken?: 'true' | 'false';
}

export interface BranchCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_true' | 'is_false';
  value?: unknown;
}

export interface DBWriteConfig {
  table: string;
  action: 'insert';
  data: Record<string, unknown>;
}

export interface NotifyConfig {
  recipient: string;
  channel?: 'in_app' | 'email' | 'webhook';
  payload?: Record<string, unknown>;
}

export interface HttpRequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface BrowserNavigateConfig {
  url: string;
  userAgent?: string;
  timeout?: number;
}

export interface StagehandActConfig {
  action: string;
  selector?: string;
  value?: string;
  url?: string;
}

export interface StagehandExtractConfig {
  instruction: string;
  schema?: Record<string, unknown>;
  url?: string;
}

export interface StagehandObserveConfig {
  targetElements?: string[];
  filterSelector?: string;
  url?: string;
}

export interface ResumeData {
  approved: boolean;
  approver_id?: string;
  output?: Record<string, unknown>;
}

