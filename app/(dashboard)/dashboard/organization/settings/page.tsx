'use client';

import React from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { OrgSelector } from '@/components/organizations/OrgSelector';

export default function OrganizationSettingsPage() {
  const { organization, role } = useOrganization();

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6">
        <h1 className="text-2xl font-black uppercase tracking-wider text-[#111]">
          Organization Settings
        </h1>
        <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
          Workspace metadata, identity, and organization context switching
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111] space-y-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-[#666] mb-2">
            Active Workspace Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111]">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
                Organization Name
              </div>
              <div className="text-base font-black text-[#111] mt-0.5">
                {organization?.name || 'Default Organization'}
              </div>
            </div>

            <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111]">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
                Organization UUID
              </div>
              <div className="text-xs font-mono font-bold text-[#111] mt-1 break-all">
                {organization?.id}
              </div>
            </div>

            <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111]">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
                Assigned Role
              </div>
              <div className="text-sm font-black uppercase text-[#7B5CF5] mt-0.5">
                {role}
              </div>
            </div>

            <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111]">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
                Created Date
              </div>
              <div className="text-xs font-bold text-[#111] mt-1">
                {organization?.created_at ? new Date(organization.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Switch Organization Section */}
        <div className="pt-4 border-t-[2px] border-[#111] space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#111]">
            Switch Organization
          </h3>
          <p className="text-xs font-bold text-[#555] uppercase tracking-wider">
            Switching organizations updates all dashboard metrics, workflows, runs, and approvals in real-time.
          </p>
          <div className="pt-1">
            <OrgSelector />
          </div>
        </div>
      </div>
    </div>
  );
}
