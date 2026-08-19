'use client';

import React from 'react';
import { useOrganization } from '@/hooks/useOrganization';

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: 'bg-[#7B5CF5] text-white border-[#111]',
  editor: 'bg-[#00C8B4] text-[#111] border-[#111]',
  viewer: 'bg-[#F0EBE2] text-[#555] border-[#111]',
};

export function OrgSelector() {
  const { organization, role, organizations, isLoading, selectOrganization } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border-[2px] border-[#111] bg-white text-xs font-black text-[#555]">
        <span className="animate-pulse">Loading orgs...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="px-3 py-1.5 rounded-xl border-[2px] border-[#111] bg-[#FF6B8A] text-xs text-white font-black uppercase tracking-wider">
        No Organizations
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2.5">
      <label htmlFor="org-select-dropdown" className="sr-only">Select Organization</label>
      <div className="relative inline-block text-left">
        <select
          id="org-select-dropdown"
          value={organization?.id || ''}
          onChange={(e) => selectOrganization(e.target.value)}
          className="appearance-none bg-white border-[2px] border-[#111] font-black text-xs uppercase tracking-wider text-[#111] rounded-xl pl-3 pr-8 py-1.5 shadow-[2px_2px_0_#111] focus:outline-none focus:shadow-[3px_3px_0_#F5C842] cursor-pointer"
        >
          {organizations.map((m) => (
            <option key={m.id || m.org_id} value={m.org_id}>
              {m.organization.name} ({m.role.toUpperCase()})
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#111]">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>

      {role && (
        <span
          className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full border-[2px] shadow-[2px_2px_0_#111] ${
            ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.viewer
          }`}
        >
          {role.toUpperCase()}
        </span>
      )}
    </div>
  );
}
