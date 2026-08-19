/**
 * Workflow Runs & Approvals GraphQL Queries (Phase P1)
 */

export const GET_ORG_WORKFLOW_RUNS = `
  query GetOrgWorkflowRuns($org_id: uuid!) {
    workflow_runs(
      where: { org_id: { _eq: $org_id } }
      order_by: { created_at: desc }
    ) {
      id
      workflow_id
      org_id
      status
      trigger_type
      input
      error
      started_at
      completed_at
      created_at
      updated_at
      workflow {
        id
        name
      }
      step_runs(order_by: { created_at: asc }) {
        id
        status
        workflow_step {
          id
          step_type
          position
        }
      }
    }
  }
`;

export const GET_PENDING_APPROVALS = `
  query GetPendingApprovals($org_id: uuid!) {
    workflow_runs(
      where: { org_id: { _eq: $org_id }, status: { _eq: "paused" } }
      order_by: { created_at: desc }
    ) {
      id
      workflow_id
      org_id
      status
      trigger_type
      started_at
      created_at
      updated_at
      workflow {
        id
        name
      }
      step_runs(
        where: { status: { _eq: "paused" } }
        order_by: { created_at: asc }
      ) {
        id
        workflow_step_id
        status
        attempt_count
        created_at
        workflow_step {
          id
          position
          step_type
          config
        }
      }
    }
  }
`;
