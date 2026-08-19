'use client';

import React from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export default function OrganizationUsagePage() {
  const { organization } = useOrganization();

  const quotaLimit = organization?.quota_limit || 100;
  const quotaUsed = organization?.quota_used || 0;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaPercentage = Math.min(Math.round((quotaUsed / quotaLimit) * 100), 100);

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6">
        <h1 className="text-2xl font-black uppercase tracking-wider text-[#111]">
          Organization Quota & Usage
        </h1>
        <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
          Atomic quota enforcement & workflow execution allowance for {organization?.name}
        </p>
      </div>

      {/* Quota Progress Meter */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111] space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-[#666]">
              Current Execution Quota
            </div>
            <div className="text-4xl font-black text-[#111] mt-1">
              {quotaUsed}{' '}
              <span className="text-lg font-bold text-[#666]">/ {quotaLimit} Runs Used</span>
            </div>
          </div>

          <div className="px-4 py-2 bg-[#F5EFE6] border-[2px] border-[#111] rounded-xl text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#666]">
              Remaining Balance
            </div>
            <div className="text-xl font-black text-[#00C8B4]">
              {quotaRemaining} Runs
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase">
            <span>Progress: {quotaPercentage}%</span>
            <span>Limit: {quotaLimit}</span>
          </div>
          <div className="w-full bg-[#E5E0D8] h-4 rounded-full border-[2px] border-[#111] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                quotaPercentage > 85 ? 'bg-[#FF6B6B]' : 'bg-[#7B5CF5]'
              }`}
              style={{ width: `${quotaPercentage}%` }}
            />
          </div>
        </div>

        {/* Usage Policy Note */}
        <div className="bg-[#F5EFE6] border-[2px] border-[#111] rounded-xl p-4 text-xs font-bold space-y-1">
          <div className="font-black uppercase text-[#111]">🔒 Quota Security Policy</div>
          <p className="text-[#555]">
            Quota is enforced atomically at the database query level on every execution attempt.
            Successful workflow runs increment quota exactly once upon completion. Failed runs do not deduct from your quota limit.
          </p>
        </div>
      </div>
    </div>
  );
}
