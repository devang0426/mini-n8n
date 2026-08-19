/**
 * Approval Gate Contract (Phase 3)
 * TypeScript Client Contract Interface for approveStep.
 * Note: Direct database mutations on approval fields (approved_by, approved_at, status) are forbidden.
 * The actual approveStep operation will be executed via Hasura Action in Phase 5.
 */

export interface ApproveStepInput {
  workflow_run_id: string;
  step_run_id: string;
  approved: boolean;
}

export interface ApproveStepResult {
  success: boolean;
  workflow_run_id: string;
  step_run_id: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  message?: string;
}

/**
 * GraphQL Mutation String for future Hasura Action contract.
 * Note: In Phase 3, this serves as the contract standard for frontend/backend integration.
 */
export const APPROVE_STEP_ACTION = `
  mutation ApproveStepAction($workflow_run_id: uuid!, $step_run_id: uuid!, $approved: Boolean!) {
    approveStep(
      workflow_run_id: $workflow_run_id
      step_run_id: $step_run_id
      approved: $approved
    ) {
      success
      workflow_run_id
      step_run_id
      status
      message
    }
  }
`;
