'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { useOrganization } from '@/hooks/useOrganization';
import { GET_ORG_MEMBERS_BY_ORG } from '@/graphql/members/queries';

interface OrgMemberData {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export default function OrganizationMembersPage() {
  const accessToken = useAccessToken();
  const { organization, role, isOwner } = useOrganization();

  const [members, setMembers] = useState<OrgMemberData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!accessToken || !organization?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await executeGraphQL<{ org_members: OrgMemberData[] }>(
        accessToken,
        GET_ORG_MEMBERS_BY_ORG,
        { org_id: organization.id }
      );
      setMembers(data.org_members || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, organization?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const ROLE_BADGE_STYLES: Record<string, string> = {
    owner: 'bg-[#7B5CF5] text-white border-[#111]',
    editor: 'bg-[#00C8B4] text-[#111] border-[#111]',
    viewer: 'bg-[#E5E0D8] text-[#555] border-[#111]',
  };

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#F5C842] border-[1.5px] border-[#111]">
              YOUR ROLE: {role?.toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#111] mt-1">
            Organization Members ({members.length})
          </h1>
          <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
            Active team members and role authorization in {organization?.name}
          </p>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111]">
        {isLoading ? (
          <div className="py-12 text-center text-xs font-black uppercase tracking-wider">
            Loading organization members...
          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-[#666] uppercase tracking-wider">
            No member records found for this organization.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-[2.5px] border-[#111] text-[#666] uppercase font-black text-[10px] tracking-wider">
                  <th className="pb-3">Member ID</th>
                  <th className="pb-3">User UUID</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] font-bold">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F5EFE6] transition-colors">
                    <td className="py-3.5 font-mono text-[11px] text-[#111]">
                      {m.id}
                    </td>
                    <td className="py-3.5 font-mono text-[11px] text-[#555]">
                      {m.user_id}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-[1.5px] ${
                          ROLE_BADGE_STYLES[m.role] || ROLE_BADGE_STYLES.viewer
                        }`}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3.5 text-[#555]">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
