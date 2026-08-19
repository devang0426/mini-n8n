'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

export default function UserProfilePage() {
  const { user, signOut } = useAuth();
  const { organization, role } = useOrganization();

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6">
        <h1 className="text-2xl font-black uppercase tracking-wider text-[#111]">
          User Profile & Security
        </h1>
        <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
          Nhost authenticated identity and active organization role
        </p>
      </div>

      {/* Details Card */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111] space-y-6">
        <div className="flex items-center space-x-4 pb-4 border-b-[2px] border-[#111]">
          <div className="h-16 w-16 rounded-2xl bg-[#F5C842] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] flex items-center justify-center text-[#111] text-2xl font-black">
            👤
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">
              {user?.displayName || 'Authenticated User'}
            </h2>
            <div className="text-xs font-bold text-[#555] font-mono mt-0.5">
              {user?.email || 'Nhost User'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111]">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
              User ID (Nhost Auth UUID)
            </div>
            <div className="text-xs font-mono font-bold text-[#111] mt-1 break-all">
              {user?.id || 'N/A'}
            </div>
          </div>

          <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111]">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
              Active Organization
            </div>
            <div className="text-xs font-bold text-[#111] mt-1">
              {organization?.name} ({role?.toUpperCase()})
            </div>
          </div>
        </div>

        <div className="pt-4 border-t-[2px] border-[#111]">
          <button
            onClick={() => signOut()}
            className="px-5 py-2.5 bg-[#FF6B6B] hover:bg-[#E55B5B] text-white border-[2.5px] border-[#111] rounded-xl font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            Sign Out of Workflo
          </button>
        </div>
      </div>
    </div>
  );
}
