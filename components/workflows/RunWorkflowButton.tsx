'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { triggerWorkflowRunAction } from '@/lib/graphql/actions';

interface RunWorkflowButtonProps {
  workflowId: string;
  isActive: boolean;
  onActivate?: () => void;
}

export function RunWorkflowButton({ workflowId, isActive, onActivate }: RunWorkflowButtonProps) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { isViewer, organization } = useOrganization();

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isQuotaExhausted =
    organization && organization.quota_limit > 0
      ? organization.quota_used >= organization.quota_limit
      : false;

  const canRun = !isViewer && isActive && !isQuotaExhausted && !isRunning;

  const handleRunWorkflow = async () => {
    if (!canRun || !accessToken) return;

    setIsRunning(true);
    setErrorMsg(null);

    try {
      const res = await triggerWorkflowRunAction(accessToken, workflowId);
      if (res.workflow_run_id) {
        router.push(`/dashboard/workflows/${workflowId}/runs/${res.workflow_run_id}`);
      } else {
        throw new Error('No workflow run ID returned from backend.');
      }
    } catch (err) {
      console.error('Error triggering workflow run:', err);
      setErrorMsg((err as Error).message);
      setIsRunning(false);
    }
  };

  if (isViewer) {
    return (
      <div className="flex items-center gap-2">
        <button
          disabled
          title="Viewers do not have permission to execute workflows"
          className="cursor-not-allowed opacity-50 px-4 py-2 bg-[#F0EBE2] text-[#555] rounded-xl border-[2.5px] border-[#111] text-xs font-black uppercase tracking-wider flex items-center gap-2"
        >
          <span>🔒</span>
          Run Workflow
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRunWorkflow}
        disabled={!canRun}
        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] cursor-pointer ${
          !canRun
            ? 'bg-[#F0EBE2] text-[#888] cursor-not-allowed shadow-[2px_2px_0_#111]'
            : 'bg-[#F5C842] hover:bg-[#E5B832] text-[#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
        }`}
      >
        {isRunning ? (
          <>
            <svg className="animate-spin w-4 h-4 text-[#111]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting Pipeline...
          </>
        ) : (
          <>
            <span className="text-sm">▶</span>
            Run Workflow
          </>
        )}
      </button>

      {!isActive && (
        <div className="flex items-center space-x-1.5 text-[11px] text-[#C49B10] font-black uppercase">
          <span>Workflow must be active to run</span>
          {onActivate && (
            <button
              type="button"
              onClick={onActivate}
              className="text-[#5B3FC8] underline hover:text-[#111] cursor-pointer font-extrabold"
            >
              (Enable Now)
            </button>
          )}
        </div>
      )}

      {isQuotaExhausted && (
        <span className="text-[11px] text-[#FF6B6B] font-black uppercase">
          Organization quota limit reached
        </span>
      )}

      {errorMsg && (
        <span className="text-[11px] text-[#FF6B6B] font-black uppercase max-w-xs truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
