/**
 * Workflow Step Mutations (Phase 3)
 */

export const CREATE_WORKFLOW_STEP = `
  mutation CreateWorkflowStep(
    $workflow_id: uuid!
    $position: Int!
    $step_type: String!
    $config: jsonb
  ) {
    insert_workflow_steps_one(
      object: {
        workflow_id: $workflow_id
        position: $position
        step_type: $step_type
        config: $config
      }
    ) {
      id
      workflow_id
      position
      step_type
      config
      created_at
      updated_at
    }
  }
`;

export const UPDATE_WORKFLOW_STEP = `
  mutation UpdateWorkflowStep(
    $id: uuid!
    $position: Int
    $step_type: String
    $config: jsonb
  ) {
    update_workflow_steps_by_pk(
      pk_columns: { id: $id }
      _set: {
        position: $position
        step_type: $step_type
        config: $config
      }
    ) {
      id
      workflow_id
      position
      step_type
      config
      created_at
      updated_at
    }
  }
`;

export const DELETE_WORKFLOW_STEP = `
  mutation DeleteWorkflowStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) {
      id
    }
  }
`;
