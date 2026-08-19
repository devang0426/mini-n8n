'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { executeGraphQL } from '@/lib/graphql/client';
import { GET_WORKFLOW_BY_ID } from '@/graphql/workflows/queries';
import { useStepRunsSubscription } from '@/hooks/useStepRunsSubscription';
import { ExecutionTimeline } from './ExecutionTimeline';
import { ApprovalGateBanner } from './ApprovalGateBanner';
import { StepDetailModal } from './StepDetailModal';
import { QuotaIndicator } from './QuotaIndicator';
import { StepRunItem } from '@/lib/graphql/subscriptions';

interface ExecutionViewProps {
  workflowId: string;
  runId: string;
}

export function ExecutionView({ workflowId, runId }: ExecutionViewProps) {
  const { accessToken } = useAuth();
  const { organization } = useOrganization();

  const [workflow, setWorkflow] = useState<any | null>(null);
  const [isWfLoading, setIsWfLoading] = useState<boolean>(true);
  const [wfError, setWfError] = useState<string | null>(null);
  const [inspectedStep, setInspectedStep] = useState<StepRunItem | null>(null);

  const {
    stepRuns,
    workflowRunStatus,
    subscriptionStatus,
    isLoading: isSubLoading,
    error: subError,
    refetch,
  } = useStepRunsSubscription(accessToken, runId);

  useEffect(() => {
    async function loadWorkflow() {
      if (!accessToken || !workflowId) return;
      setIsWfLoading(true);
      try {
        const data = await executeGraphQL<any>(accessToken, GET_WORKFLOW_BY_ID, { id: workflowId });
        const wf = data.workflows_by_pk;
        if (!wf) {
          setWfError('Workflow not found.');
        } else if (organization && wf.org_id !== organization.id) {
          setWfError('Unauthorized: Workflow belongs to a different organization.');
        } else {
          setWorkflow(wf);
        }
      } catch (err) {
        console.error('Error fetching workflow details:', err);
        setWfError((err as Error).message);
      } finally {
        setIsWfLoading(false);
      }
    }

    loadWorkflow();
  }, [accessToken, workflowId, organization]);

  if (isWfLoading || isSubLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="flex items-center space-x-3 px-6 py-4 rounded-xl border-[2.5px] border-[#111] bg-white shadow-[4px_4px_0_#111]">
          <svg className="animate-spin h-5 w-5 text-[#111]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs font-black uppercase tracking-wider text-[#111]">Loading live execution state...</span>
        </div>
      </div>
    );
  }

  if (wfError || !workflow) {
    return (
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-8 max-w-2xl mx-auto text-center space-y-4 my-12">
        <div className="w-14 h-14 rounded-2xl bg-[#FF6B6B] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] text-white flex items-center justify-center mx-auto text-2xl font-black">
          ⚠️
        </div>
        <h2 className="text-2xl font-black uppercase tracking-wider text-[#111]">Workflow Run Unavailable</h2>
        <p className="text-xs font-bold uppercase text-[#555]">{wfError || 'The requested workflow run could not be accessed.'}</p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 bg-[#F5C842] hover:bg-[#E5B832] text-[#111] border-[2.5px] border-[#111] rounded-xl text-xs font-black uppercase tracking-wider shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const currentOverallStatus = workflowRunStatus || 'running';
  const pausedStepRun = stepRuns.find((sr) => sr.status === 'paused') || null;

  let overallStatusBadgeClass = 'bg-[#F0EBE2] text-[#555]';
  if (currentOverallStatus === 'completed') overallStatusBadgeClass = 'bg-[#B6F5C8] text-[#0A6630]';
  else if (currentOverallStatus === 'running') overallStatusBadgeClass = 'bg-[#00C8B4] text-[#111]';
  else if (currentOverallStatus === 'paused') overallStatusBadgeClass = 'bg-[#F5C842] text-[#111] animate-pulse';
  else if (currentOverallStatus === 'failed') overallStatusBadgeClass = 'bg-[#FF6B6B] text-white';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111]">
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-xs font-black uppercase text-[#555] mb-1">
            <Link href="/dashboard" className="hover:underline">Workflows</Link>
            <span>/</span>
            <Link href={`/dashboard/workflows/${workflowId}`} className="hover:underline text-[#111]">
              {workflow.name}
            </Link>
            <span>/</span>
            <span className="text-[#111] font-mono">Run #{runId.substring(0, 8)}</span>
          </nav>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black uppercase tracking-wider text-[#111]">{workflow.name} Execution</h1>
            <span className={`text-xs px-3 py-1 rounded-full font-black uppercase tracking-wider border-[2px] border-[#111] ${overallStatusBadgeClass}`}>
              {currentOverallStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Connection & Quota status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold bg-[#F5EFE6] px-3 py-1.5 rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111]">
            <span
              className={`w-2.5 h-2.5 rounded-full border-[1px] border-[#111] ${
                subscriptionStatus === 'connected'
                  ? 'bg-[#00C8B4] animate-pulse'
                  : subscriptionStatus === 'connecting'
                  ? 'bg-[#F5C842]'
                  : 'bg-[#FF6B6B]'
              }`}
            />
            <span className="text-[#111] uppercase">Live Updates: {subscriptionStatus}</span>
          </div>

          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 bg-[#F5C842] hover:bg-[#E5B832] text-[#111] rounded-xl text-xs font-black uppercase tracking-wider border-[2px] border-[#111] shadow-[2px_2px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Quota Indicator */}
      <QuotaIndicator />

      {/* Subscription Error Notification */}
      {subError && (
        <div className="bg-[#FF6B6B] border-[2.5px] border-[#111] text-white rounded-2xl p-4 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between shadow-[4px_4px_0_#111]">
          <span>Live updates unavailable: {subError}</span>
          <button onClick={() => refetch()} className="underline font-black hover:text-[#F5C842]">
            Retry Connection
          </button>
        </div>
      )}

      {/* Approval Gate Banner (If workflow run is paused) */}
      {currentOverallStatus === 'paused' && (
        <ApprovalGateBanner
          workflowRunId={runId}
          pausedStepRun={pausedStepRun}
          onApprovalComplete={() => refetch()}
        />
      )}

      {/* Execution Timeline */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111]">
        <ExecutionTimeline
          stepRuns={stepRuns}
          onInspectStep={(step) => setInspectedStep(step)}
        />
      </div>

      {/* Step Detail Inspector Modal */}
      <StepDetailModal
        stepRun={inspectedStep}
        onClose={() => setInspectedStep(null)}
      />
    </div>
  );
}
