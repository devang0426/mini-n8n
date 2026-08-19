'use client';

import Link from 'next/link';

export interface WorkflowRunSummary {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

interface RunHistoryProps {
  workflowId: string;
  runs: WorkflowRunSummary[];
}

export function RunHistory({ workflowId, runs }: RunHistoryProps) {
  if (!runs || runs.length === 0) {
    return (
      <div className="bg-white border-[2.5px] border-[#111] rounded-2xl p-6 text-center shadow-[4px_4px_0_#111] mt-8">
        <p className="text-xs font-black uppercase text-[#555]">No execution history recorded for this workflow yet.</p>
        <p className="text-[11px] font-bold text-[#888] uppercase mt-1">Click &ldquo;Run Workflow&rdquo; to trigger an execution.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#111] flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-[#F5C842] border-[2px] border-[#111] flex items-center justify-center text-[#111] text-xs font-black shadow-[1.5px_1.5px_0_#111]">
            ⏱
          </span>
          Recent Execution History ({runs.length})
        </h3>
      </div>

      <div className="bg-white border-[2.5px] border-[#111] rounded-2xl overflow-hidden shadow-[4px_4px_0_#111]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5EFE6] border-b-[2.5px] border-[#111] text-xs font-black text-[#111] uppercase tracking-wider">
                <th className="px-4 py-3">Run ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-[1.5px] divide-[#111] font-mono text-xs">
              {runs.map((r) => {
                let statusBadgeClass = 'bg-[#F0EBE2] text-[#555]';
                if (r.status === 'completed') statusBadgeClass = 'bg-[#B6F5C8] text-[#0A6630]';
                else if (r.status === 'running') statusBadgeClass = 'bg-[#00C8B4] text-[#111]';
                else if (r.status === 'paused') statusBadgeClass = 'bg-[#F5C842] text-[#111]';
                else if (r.status === 'failed') statusBadgeClass = 'bg-[#FF6B6B] text-white';

                let durationStr = 'N/A';
                if (r.started_at && r.completed_at) {
                  const ms = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
                  durationStr = `${(ms / 1000).toFixed(2)}s`;
                }

                return (
                  <tr key={r.id} className="hover:bg-[#F5EFE6] transition-colors">
                    <td className="px-4 py-3 font-black text-[#111]">
                      #{r.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border-[1.5px] border-[#111] ${statusBadgeClass}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#555] font-sans font-bold">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[#111] font-bold">
                      {durationStr}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <Link
                        href={`/dashboard/workflows/${workflowId}/runs/${r.id}`}
                        className="px-3 py-1 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] rounded-lg border-[1.5px] border-[#111] shadow-[1.5px_1.5px_0_#111] inline-flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        View Live Run
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
