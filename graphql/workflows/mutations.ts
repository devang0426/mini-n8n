/**
 * Workflow Mutations (Phase 3)
 */

export const CREATE_WORKFLOW = `
  mutation CreateWorkflow(
    $org_id: uuid!
    $name: String!
    $description: String
    $is_active: Boolean
  ) {
    insert_workflows_one(
      object: {
        org_id: $org_id
        name: $name
        description: $description
        is_active: $is_active
      }
    ) {
      id
      org_id
      name
      description
      is_active
      created_by
      created_at
      updated_at
    }
  }
`;

export const UPDATE_WORKFLOW = `
  mutation UpdateWorkflow(
    $id: uuid!
    $name: String
    $description: String
    $is_active: Boolean
  ) {
    update_workflows_by_pk(
      pk_columns: { id: $id }
      _set: {
        name: $name
        description: $description
        is_active: $is_active
      }
    ) {
      id
      org_id
      name
      description
      is_active
      created_by
      created_at
      updated_at
    }
  }
`;

export const DELETE_WORKFLOW = `
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;
