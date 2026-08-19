'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { approveStepAction } from '@/lib/graphql/actions';
import { StepRunItem } from '@/lib/graphql/subscriptions';

interface ApprovalGateBannerProps {
  workflowRunId: string;
  pausedStepRun: StepRunItem | null;
  onApprovalComplete?: () => void;
}

export function ApprovalGateBanner({
  workflowRunId,
  pausedStepRun,
  onApprovalComplete,
}: ApprovalGateBannerProps) {
  const { accessToken } = useAuth();
  const { isViewer } = useOrganization();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!pausedStepRun) return null;

  const approvalMessage =
    pausedStepRun.workflow_step?.config?.message ||
    'Human approval is required before this workflow can proceed to subsequent steps.';

  const handleDecision = async (approved: boolean) => {
    if (!accessToken || isSubmitting || isViewer) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await approveStepAction(accessToken, workflowRunId, pausedStepRun.id, approved);
      if (onApprovalComplete) {
        onApprovalComplete();
      }
    } catch (err) {
      console.error('Error approving step:', err);
      setErrorMsg((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F5C842] border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111] relative overflow-hidden my-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#FF6B8A] border-[1.5px] border-[#111] animate-ping" />
            <span className="text-xs font-black text-[#111] uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border-[1.5px] border-[#111]">
              WORKFLOW PAUSED
            </span>
          </div>

          <h3 className="text-2xl font-black text-[#111] uppercase tracking-wider flex items-center gap-2">
            <span>✋</span>
            HUMAN APPROVAL REQUIRED
          </h3>

          <p className="text-xs font-mono font-bold text-[#111] bg-white p-3.5 rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111]">
            &ldquo;{approvalMessage}&rdquo;
          </p>
        </div>

        {/* Action Controls */}
        <div className="w-full md:w-auto flex flex-col items-end gap-3">
          {isViewer ? (
            <div className="bg-white border-[2px] border-[#111] rounded-xl p-3 text-xs font-black uppercase text-[#FF6B6B] shadow-[2px_2px_0_#111]">
              Awaiting approval — you do not have permission to approve.
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => handleDecision(false)}
                disabled={isSubmitting}
                className="flex-1 md:flex-none px-5 py-3 bg-[#FF6B6B] hover:bg-[#E55B5B] text-white border-[2.5px] border-[#111] rounded-xl font-black text-xs uppercase tracking-wider shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  'Processing...'
                ) : (
                  <>
                    <span>✗</span>
                    REJECT RUN
                  </>
                )}
              </button>

              <button
                onClick={() => handleDecision(true)}
                disabled={isSubmitting}
                className="flex-1 md:flex-none px-6 py-3 bg-[#00C8B4] hover:bg-[#00B4A2] text-[#111] border-[2.5px] border-[#111] rounded-xl font-black text-xs uppercase tracking-wider shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  'Processing...'
                ) : (
                  <>
                    <span>✓</span>
                    APPROVE & RESUME
                  </>
                )}
              </button>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-[#FF6B6B] font-black uppercase max-w-xs text-right bg-white p-1.5 rounded-lg border-[1.5px] border-[#111]">
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
