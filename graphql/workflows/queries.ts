/**
 * Workflow Queries (Phase 3)
 */

export const GET_WORKFLOWS_BY_ORG = `
  query GetWorkflowsByOrg($org_id: uuid!) {
    workflows(
      where: { org_id: { _eq: $org_id } }
      order_by: { created_at: desc }
    ) {
      id
      org_id
      name
      description
      is_active
      created_by
      created_at
      updated_at
      steps(order_by: { position: asc }) {
        id
        workflow_id
        position
        step_type
        config
        created_at
        updated_at
      }
      triggers {
        id
        workflow_id
        trigger_type
        config
        is_enabled
        created_at
        updated_at
      }
      runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        started_at
        completed_at
        created_at
      }
    }
  }
`;

export const GET_WORKFLOW_BY_ID = `
  query GetWorkflowById($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      org_id
      name
      description
      is_active
      created_by
      created_at
      updated_at
      steps(order_by: { position: asc }) {
        id
        workflow_id
        position
        step_type
        config
        created_at
        updated_at
      }
      triggers {
        id
        workflow_id
        trigger_type
        config
        is_enabled
        created_at
        updated_at
      }
      runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        started_at
        completed_at
        created_at
      }
    }
  }
`;
