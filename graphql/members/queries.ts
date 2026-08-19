/**
 * Organization Members GraphQL Query (Phase P1)
 */

export const GET_ORG_MEMBERS_BY_ORG = `
  query GetOrgMembersByOrg($org_id: uuid!) {
    org_members(
      where: { org_id: { _eq: $org_id } }
      order_by: { created_at: asc }
    ) {
      id
      org_id
      user_id
      role
      created_at
      updated_at
    }
  }
`;
