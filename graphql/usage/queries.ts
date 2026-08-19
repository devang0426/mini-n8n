/**
 * Organization Quota / Usage Queries (Phase 3)
 */

export const GET_ORGANIZATION_USAGE = `
  query GetOrganizationUsage {
    organizations {
      id
      name
      quota_limit
      quota_used
      quota_reset_at
      created_at
      updated_at
    }
  }
`;

export const GET_ORGANIZATION_USAGE_BY_ID = `
  query GetOrganizationUsageById($org_id: uuid!) {
    organizations_by_pk(id: $org_id) {
      id
      name
      quota_limit
      quota_used
      quota_reset_at
      created_at
      updated_at
    }
  }
`;
