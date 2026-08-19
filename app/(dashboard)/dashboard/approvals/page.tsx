'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { useOrganization } from '@/hooks/useOrganization';
import { GET_PENDING_APPROVALS } from '@/graphql/runs/queries';
import { approveStepAction } from '@/lib/graphql/actions';

interface StepRunData {
  id: string;
  workflow_step_id: string;
  status: string;
  attempt_count: number;
  created_at: string;
  workflow_step?: {
    id: string;
    position: number;
    step_type: string;
    config?: {
      message?: string;
    };
  };
}

interface PendingApprovalRun {
  id: string;
  workflow_id: string;
  org_id: string;
  status: string;
  trigger_type: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
  workflow?: {
    id: string;
    name: string;
  };
  step_runs: StepRunData[];
}

export default function ApprovalsPage() {
  const accessToken = useAccessToken();
  const { organization, isViewer } = useOrganization();

  const [approvals, setApprovals] = useState<PendingApprovalRun[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingRunId, setSubmittingRunId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!accessToken || !organization?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await executeGraphQL<{ workflow_runs: PendingApprovalRun[] }>(
        accessToken,
        GET_PENDING_APPROVALS,
        { org_id: organization.id }
      );
      setApprovals(data.workflow_runs || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, organization?.id]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecision = async (runId: string, stepRunId: string, approved: boolean) => {
    if (!accessToken || submittingRunId || isViewer) return;

    setSubmittingRunId(runId);
    try {
      await approveStepAction(accessToken, runId, stepRunId, approved);
      await fetchApprovals();
    } catch (err) {
      alert((err as Error).message || 'Failed to submit approval decision.');
    } finally {
      setSubmittingRunId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-[#FF6B6B] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6B6B]">
              HUMAN-IN-THE-LOOP INBOX
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#111] mt-1">
            Pending Approvals ({approvals.length})
          </h1>
          <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
            Workflows currently paused at approval gates awaiting owner/editor decision
          </p>
        </div>

        <button
          onClick={fetchApprovals}
          className="px-3.5 py-2 text-xs font-black uppercase tracking-wider bg-white border-[2px] border-[#111] rounded-xl shadow-[2px_2px_0_#111] hover:bg-[#F5EFE6] transition-all cursor-pointer"
        >
          🔄 Refresh Inbox
        </button>
      </div>

      {/* Main Inbox List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-12 text-center text-xs font-black uppercase tracking-wider">
            Fetching pending approvals...
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-12 shadow-[6px_6px_0_#111] text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">
              No Pending Approvals
            </h2>
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider max-w-md mx-auto">
              All workflow executions in {organization?.name} are either completed or running smoothly without paused approval gates.
            </p>
          </div>
        ) : (
          approvals.map((run) => {
            const pausedStepRun = run.step_runs?.find((sr) => sr.status === 'paused');
            const message =
              pausedStepRun?.workflow_step?.config?.message ||
              'Human approval required to proceed with subsequent workflow steps.';

            return (
              <div
                key={run.id}
                className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111] flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-1 bg-[#F5C842] border-[1.5px] border-[#111] rounded-lg text-[10px] font-black uppercase tracking-wider">
                      PAUSED AT GATE
                    </span>
                    <span className="text-xs font-black uppercase text-[#111]">
                      Workflow: <strong>{run.workflow?.name}</strong>
                    </span>
                  </div>

                  <div className="text-xs font-mono font-bold bg-[#F5EFE6] p-3 rounded-xl border-[1.5px] border-[#111]">
                    &ldquo;{message}&rdquo;
                  </div>

                  <div className="text-[10px] font-bold text-[#666] uppercase space-x-3">
                    <span>Run ID: {run.id}</span>
                    <span>•</span>
                    <span>Started: {new Date(run.started_at || run.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <Link
                    href={`/dashboard/workflows/${run.workflow_id}/runs/${run.id}`}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white text-[#111] border-[2px] border-[#111] rounded-xl font-black text-xs uppercase tracking-wider text-center shadow-[2px_2px_0_#111] hover:bg-[#F5EFE6] transition-all"
                  >
                    Inspect Run
                  </Link>

                  {isViewer ? (
                    <span className="text-xs font-black uppercase text-[#FF6B6B] bg-[#F5EFE6] px-3 py-2 rounded-xl border-[1.5px] border-[#111]">
                      Read-only Viewer
                    </span>
                  ) : (
                    pausedStepRun && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleDecision(run.id, pausedStepRun.id, false)}
                          disabled={submittingRunId === run.id}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-[#FF6B6B] text-white border-[2px] border-[#111] rounded-xl font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#111] hover:bg-[#E55B5B] disabled:opacity-50 transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleDecision(run.id, pausedStepRun.id, true)}
                          disabled={submittingRunId === run.id}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-[#00C8B4] text-[#111] border-[2px] border-[#111] rounded-xl font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#111] hover:bg-[#00B4A2] disabled:opacity-50 transition-all cursor-pointer"
                        >
                          Approve & Resume
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
