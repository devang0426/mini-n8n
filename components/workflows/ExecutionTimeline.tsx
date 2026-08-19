'use client';

import { StepRunItem } from '@/lib/graphql/subscriptions';

interface ExecutionTimelineProps {
  stepRuns: StepRunItem[];
  onInspectStep?: (stepRun: StepRunItem) => void;
}

export function ExecutionTimeline({ stepRuns, onInspectStep }: ExecutionTimelineProps) {
  if (!stepRuns || stepRuns.length === 0) {
    return (
      <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-8 text-center shadow-[4px_4px_0_#111]">
        <p className="text-xs font-black uppercase text-[#555]">No step executions recorded for this run.</p>
      </div>
    );
  }

  const sortedRuns = [...stepRuns].sort(
    (a, b) => (a.workflow_step?.position || 0) - (b.workflow_step?.position || 0)
  );

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-[#111] flex items-center gap-2">
        <span className="h-6 w-6 rounded-lg bg-[#F5C842] border-[2px] border-[#111] flex items-center justify-center text-[#111] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
          📋
        </span>
        Execution Timeline
      </h3>

      <div className="relative border-l-[3.5px] border-[#111] ml-4 pl-6 space-y-6">
        {sortedRuns.map((sr) => {
          const stepPos = sr.workflow_step?.position || 1;
          const stepType = sr.workflow_step?.step_type || 'unknown';

          let statusBadgeClass = 'bg-[#F0EBE2] text-[#555]';
          let statusText = 'PENDING';
          let icon = (
            <div className="w-7 h-7 rounded-full bg-white border-[2.5px] border-[#111] flex items-center justify-center text-[#111] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
              ○
            </div>
          );

          if (sr.status === 'running') {
            statusBadgeClass = 'bg-[#00C8B4] text-[#111]';
            statusText = 'RUNNING';
            icon = (
              <div className="w-7 h-7 rounded-full bg-[#00C8B4] border-[2.5px] border-[#111] flex items-center justify-center text-[#111] text-xs font-black animate-spin shadow-[1.5px_1.5px_0_#111]">
                ⟳
              </div>
            );
          } else if (sr.status === 'paused') {
            statusBadgeClass = 'bg-[#F5C842] text-[#111] animate-pulse';
            statusText = 'PAUSED / AWAITING APPROVAL';
            icon = (
              <div className="w-7 h-7 rounded-full bg-[#F5C842] border-[2.5px] border-[#111] flex items-center justify-center text-[#111] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
                ⏸
              </div>
            );
          } else if (sr.status === 'completed') {
            statusBadgeClass = 'bg-[#B6F5C8] text-[#0A6630]';
            statusText = 'COMPLETED';
            icon = (
              <div className="w-7 h-7 rounded-full bg-[#B6F5C8] border-[2.5px] border-[#111] flex items-center justify-center text-[#0A6630] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
                ✓
              </div>
            );
          } else if (sr.status === 'failed') {
            statusBadgeClass = 'bg-[#FF6B6B] text-white';
            statusText = 'FAILED';
            icon = (
              <div className="w-7 h-7 rounded-full bg-[#FF6B6B] border-[2.5px] border-[#111] flex items-center justify-center text-white text-xs font-black shadow-[1.5px_1.5px_0_#111]">
                ✗
              </div>
            );
          } else if (sr.status === 'skipped') {
            statusBadgeClass = 'bg-[#F0EBE2] text-[#888]';
            statusText = 'SKIPPED';
            icon = (
              <div className="w-7 h-7 rounded-full bg-[#F0EBE2] border-[2.5px] border-[#111] flex items-center justify-center text-[#888] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
                ⊘
              </div>
            );
          }

          let durationStr = '';
          if (sr.started_at && sr.completed_at) {
            const ms = new Date(sr.completed_at).getTime() - new Date(sr.started_at).getTime();
            durationStr = `${(ms / 1000).toFixed(2)}s`;
          }

          return (
            <div key={sr.id} className="relative group">
              <div className="absolute -left-[38px] top-1">
                {icon}
              </div>

              <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-4 shadow-[4px_4px_0_#111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111] transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-[#111] px-2 py-0.5 bg-[#F5EFE6] rounded-md border-[1.5px] border-[#111]">
                      STEP #{stepPos}
                    </span>
                    <span className="font-black text-sm uppercase tracking-wider text-[#111]">
                      {stepType.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border-[2px] border-[#111] ${statusBadgeClass}`}>
                      {statusText}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {durationStr && (
                      <span className="text-xs font-mono font-bold text-[#555]">
                        {durationStr}
                      </span>
                    )}
                    {onInspectStep && (
                      <button
                        onClick={() => onInspectStep(sr)}
                        className="px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg bg-[#F5C842] border-[1.5px] border-[#111] shadow-[1.5px_1.5px_0_#111] hover:bg-[#E5B832] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>

                {sr.error && (
                  <div className="mt-2 text-xs bg-[#FF6B6B] border-[2px] border-[#111] text-white rounded-xl p-2.5 font-mono font-bold overflow-x-auto">
                    {sr.error}
                  </div>
                )}

                {sr.approved_by && (
                  <div className="mt-2 text-xs font-black uppercase tracking-wider text-[#0A6630] bg-[#B6F5C8] border-[1.5px] border-[#111] rounded-lg p-2 flex items-center gap-1.5">
                    <span>✓ Approved by {sr.approved_by} at {new Date(sr.approved_at!).toLocaleString()}</span>
                  </div>
                )}

                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-[#555] font-mono font-bold">
                  <span>Attempts: {sr.attempt_count}</span>
                  {sr.started_at && <span>Started: {new Date(sr.started_at).toLocaleTimeString()}</span>}
                  {sr.completed_at && <span>Completed: {new Date(sr.completed_at).toLocaleTimeString()}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
