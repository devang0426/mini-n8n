/**
 * Organization Queries (Phase 6A)
 * Uses Hasura permissions to return org_members records for the authenticated user.
 */

export interface Organization {
  id: string;
  name: string;
  quota_limit: number;
  quota_used: number;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  organization: Organization;
}

export const GET_USER_ORGANIZATIONS = `
  query GetUserOrganizations {
    org_members {
      id
      org_id
      user_id
      role
      organization {
        id
        name
        quota_limit
        quota_used
        created_at
        updated_at
      }
    }
  }
`;
