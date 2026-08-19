/**
 * Subscriptions & Live Polling Helpers (Phase 6C)
 * Provides STEP_RUNS_SUBSCRIPTION and GET_STEP_RUNS_QUERY definitions and types.
 */

export { STEP_RUNS_SUBSCRIPTION, GET_STEP_RUNS_QUERY } from '../../graphql/subscriptions/stepRuns';

export interface StepRunItem {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  input?: any;
  output?: any;
  error?: string | null;
  attempt_count: number;
  approved_by?: string | null;
  approved_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  workflow_step: {
    id: string;
    position: number;
    step_type: string;
    config: any;
  };
  workflow_run?: {
    id: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  };
}

export interface GetStepRunsResponse {
  step_runs: StepRunItem[];
}
