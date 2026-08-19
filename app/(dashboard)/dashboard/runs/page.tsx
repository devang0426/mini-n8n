'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { useOrganization } from '@/hooks/useOrganization';
import { GET_ORG_WORKFLOW_RUNS } from '@/graphql/runs/queries';

interface WorkflowRunData {
  id: string;
  workflow_id: string;
  org_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  trigger_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  workflow?: {
    id: string;
    name: string;
  };
}

export default function RunsPage() {
  const accessToken = useAccessToken();
  const { organization } = useOrganization();

  const [runs, setRuns] = useState<WorkflowRunData[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!accessToken || !organization?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await executeGraphQL<{ workflow_runs: WorkflowRunData[] }>(
        accessToken,
        GET_ORG_WORKFLOW_RUNS,
        { org_id: organization.id }
      );
      setRuns(data.workflow_runs || []);
    } catch (err) {
      setError((err as Error).message);
    } fontFinally: {
      setIsLoading(false);
    }
  }, [accessToken, organization?.id]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const filteredRuns = runs.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-[#A855F7] text-white border-[#111]',
    failed: 'bg-[#FF6B6B] text-white border-[#111]',
    running: 'bg-[#00C8B4] text-[#111] border-[#111] animate-pulse',
    paused: 'bg-[#F5C842] text-[#111] border-[#111]',
    pending: 'bg-[#E5E0D8] text-[#555] border-[#111]',
  };

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#111]">
            Execution History & Runs
          </h1>
          <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
            Real-time audit log of all workflow runs across {organization?.name}
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F5EFE6] p-1.5 rounded-xl border-[2px] border-[#111]">
          {['all', 'running', 'paused', 'completed', 'failed'].map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setFilter(statusKey)}
              className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border-[1.5px] transition-all cursor-pointer ${
                filter === statusKey
                  ? 'bg-[#F5C842] text-[#111] border-[#111] shadow-[2px_2px_0_#111]'
                  : 'bg-white text-[#555] border-transparent hover:border-[#111]'
              }`}
            >
              {statusKey}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111]">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center space-x-3 text-xs font-black uppercase tracking-wider">
            <svg className="animate-spin h-5 w-5 text-[#111]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Fetching execution runs...</span>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F5C842] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] flex items-center justify-center text-2xl mx-auto font-black text-[#111]">
              🔄
            </div>
            <h3 className="text-lg font-black uppercase tracking-wider text-[#111]">No Workflow Runs Yet</h3>
            <p className="text-xs font-bold text-[#555] uppercase tracking-wider max-w-sm mx-auto">
              {filter !== 'all'
                ? `No execution runs found matching filter "${filter}".`
                : 'Run a workflow manually or trigger a webhook to see execution history here.'}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-2 px-4 py-2 text-xs font-black uppercase tracking-wider bg-[#F5EFE6] border-[2px] border-[#111] rounded-xl shadow-[2px_2px_0_#111] hover:bg-[#F5C842] transition-all"
              >
                Show All Runs
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-[2.5px] border-[#111] text-[#666] uppercase font-black text-[10px] tracking-wider">
                  <th className="pb-3">Run ID</th>
                  <th className="pb-3">Workflow Name</th>
                  <th className="pb-3">Trigger Source</th>
                  <th className="pb-3">Execution Status</th>
                  <th className="pb-3">Started Timestamp</th>
                  <th className="pb-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] font-bold">
                {filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-[#F5EFE6] transition-colors">
                    <td className="py-3.5 font-mono text-[11px] text-[#111]">
                      {run.id}
                    </td>
                    <td className="py-3.5 font-black text-[#111]">
                      {run.workflow?.name || 'Workflow'}
                    </td>
                    <td className="py-3.5 uppercase text-[10px]">
                      {run.trigger_type || 'manual'}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border-[1.5px] ${
                          STATUS_STYLES[run.status] || STATUS_STYLES.pending
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-[#555]">
                      {run.started_at ? new Date(run.started_at).toLocaleString() : new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={`/dashboard/workflows/${run.workflow_id}/runs/${run.id}`}
                        className="px-3 py-1.5 text-[10px] font-black uppercase bg-[#F5C842] border-[1.5px] border-[#111] rounded-lg shadow-[2px_2px_0_#111] hover:bg-[#E5B832] transition-all"
                      >
                        Inspect Execution →
                      </Link>
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
