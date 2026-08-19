/**
 * Step Runs Subscription (Phase 3)
 * Rooted at step_runs, exposing step_run fields and workflow_run.status ('paused') via relationship.
 */

export const STEP_RUNS_SUBSCRIPTION = `
  subscription StepRunsSubscription($workflow_run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflow_run_id } }
      order_by: { created_at: asc }
    ) {
      id
      workflow_run_id
      workflow_step_id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      created_at
      updated_at
      workflow_step {
        id
        position
        step_type
        config
      }
      workflow_run {
        id
        status
      }
    }
  }
`;

export const GET_STEP_RUNS_QUERY = `
  query GetStepRuns($workflow_run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflow_run_id } }
      order_by: { created_at: asc }
    ) {
      id
      workflow_run_id
      workflow_step_id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      created_at
      updated_at
      workflow_step {
        id
        position
        step_type
        config
      }
      workflow_run {
        id
        status
      }
    }
  }
`;
