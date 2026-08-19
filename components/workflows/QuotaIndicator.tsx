'use client';

import { useOrganization } from '@/hooks/useOrganization';

export function QuotaIndicator() {
  const { organization, isLoading } = useOrganization();

  if (isLoading || !organization) {
    return (
      <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-4 shadow-[4px_4px_0_#111] animate-pulse">
        <div className="h-4 bg-[#F0EBE2] border-[1.5px] border-[#111] rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-[#F0EBE2] border-[1.5px] border-[#111] rounded-full w-full"></div>
      </div>
    );
  }

  const { quota_used, quota_limit, name } = organization;
  const percentage = quota_limit > 0 ? Math.min(100, Math.round((quota_used / quota_limit) * 100)) : 0;
  const remaining = Math.max(0, quota_limit - quota_used);

  let barColor = 'bg-[#B6F5C8]';
  let textColor = 'text-[#111]';
  if (percentage >= 90) {
    barColor = 'bg-[#FF6B6B]';
    textColor = 'text-[#FF6B6B]';
  } else if (percentage >= 70) {
    barColor = 'bg-[#F5C842]';
    textColor = 'text-[#C49B10]';
  }

  return (
    <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-4 shadow-[4px_4px_0_#111]">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-[#F5C842] border-[2px] border-[#111] flex items-center justify-center text-[#111] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
            ⚡
          </span>
          <span className="font-black uppercase tracking-wider text-xs text-[#111]">Execution Quota</span>
          <span className="text-[11px] font-bold text-[#555] uppercase">({name})</span>
        </div>
        <div className={`font-mono text-xs font-black ${textColor}`}>
          {quota_used} / {quota_limit} RUNS ({remaining} REMAINING)
        </div>
      </div>

      <div className="w-full bg-[#F0EBE2] border-[2px] border-[#111] h-3 rounded-full overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full border-[1px] border-[#111] transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {percentage >= 100 && (
        <p className="text-xs text-[#FF6B6B] mt-2 font-black uppercase tracking-wider flex items-center gap-1.5">
          <span>⚠️</span>
          Quota exhausted. Contact administrator to increase run limit.
        </p>
      )}
    </div>
  );
}
