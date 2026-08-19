/**
 * Workflow Trigger Mutations (Phase 3)
 */

export const CREATE_WORKFLOW_TRIGGER = `
  mutation CreateWorkflowTrigger(
    $workflow_id: uuid!
    $trigger_type: String!
    $config: jsonb
    $is_enabled: Boolean
  ) {
    insert_workflow_triggers_one(
      object: {
        workflow_id: $workflow_id
        trigger_type: $trigger_type
        config: $config
        is_enabled: $is_enabled
      }
    ) {
      id
      workflow_id
      trigger_type
      config
      is_enabled
      created_at
      updated_at
    }
  }
`;

export const UPDATE_WORKFLOW_TRIGGER = `
  mutation UpdateWorkflowTrigger(
    $id: uuid!
    $trigger_type: String
    $config: jsonb
    $is_enabled: Boolean
  ) {
    update_workflow_triggers_by_pk(
      pk_columns: { id: $id }
      _set: {
        trigger_type: $trigger_type
        config: $config
        is_enabled: $is_enabled
      }
    ) {
      id
      workflow_id
      trigger_type
      config
      is_enabled
      created_at
      updated_at
    }
  }
`;

export const DELETE_WORKFLOW_TRIGGER = `
  mutation DeleteWorkflowTrigger($id: uuid!) {
    delete_workflow_triggers_by_pk(id: $id) {
      id
    }
  }
`;
