'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAccessToken, useAuthenticated } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { GET_USER_ORGANIZATIONS, OrgMember, Organization } from '@/graphql/organizations/queries';

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface OrganizationContextType {
  organization: Organization | null;
  role: UserRole | null;
  organizations: OrgMember[];
  isLoading: boolean;
  error: string | null;
  selectOrganization: (orgId: string) => boolean;
  refreshOrganizations: () => Promise<void>;
  // UI Role Helpers (Presentation only)
  isOwner: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canEditWorkflow: boolean;
  canRunWorkflow: boolean;
  canManageMembers: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = 'workflo_selected_org_id';

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAccessToken();
  const isAuthenticated = useAuthenticated();

  const [memberships, setMemberships] = useState<OrgMember[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setMemberships([]);
      setSelectedOrgId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await executeGraphQL<{ org_members: OrgMember[] }>(
        accessToken,
        GET_USER_ORGANIZATIONS
      );

      const rawOrgs = data.org_members || [];
      const uniqueMap = new Map<string, OrgMember>();
      for (const m of rawOrgs) {
        if (!uniqueMap.has(m.org_id)) {
          uniqueMap.set(m.org_id, m);
        }
      }
      const orgs = Array.from(uniqueMap.values());
      setMemberships(orgs);

      // Restore previously selected org if still valid
      const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_ORG_KEY) : null;
      const validStored = orgs.find((m) => m.org_id === storedOrgId);

      if (validStored) {
        setSelectedOrgId(validStored.org_id);
      } else if (orgs.length > 0) {
        // Fallback to first available organization
        setSelectedOrgId(orgs[0].org_id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(SELECTED_ORG_KEY, orgs[0].org_id);
        }
      } else {
        setSelectedOrgId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(SELECTED_ORG_KEY);
        }
      }
    } catch (err) {
      const msg = (err as Error).message || 'Failed to fetch organizations.';
      setError(msg);
      setMemberships([]);
      setSelectedOrgId(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const selectOrganization = useCallback(
    (orgId: string): boolean => {
      // Validate that user actually belongs to orgId
      const target = memberships.find((m) => m.org_id === orgId);
      if (!target) {
        console.warn(`[OrganizationContext] Selection rejected: User is not a member of org ${orgId}`);
        return false;
      }

      setSelectedOrgId(orgId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(SELECTED_ORG_KEY, orgId);
      }
      return true;
    },
    [memberships]
  );

  const currentMembership = useMemo(() => {
    if (!selectedOrgId) return null;
    return memberships.find((m) => m.org_id === selectedOrgId) || null;
  }, [memberships, selectedOrgId]);

  const activeOrg = currentMembership?.organization || null;
  const activeRole = currentMembership?.role || null;

  // Presentation UI Role Helpers
  const isOwner = activeRole === 'owner';
  const isEditor = activeRole === 'editor';
  const isViewer = activeRole === 'viewer';

  const canEditWorkflow = isOwner || isEditor;
  const canRunWorkflow = isOwner || isEditor;
  const canManageMembers = isOwner;

  const value: OrganizationContextType = {
    organization: activeOrg,
    role: activeRole,
    organizations: memberships,
    isLoading,
    error,
    selectOrganization,
    refreshOrganizations: fetchOrganizations,
    isOwner,
    isEditor,
    isViewer,
    canEditWorkflow,
    canRunWorkflow,
    canManageMembers,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
