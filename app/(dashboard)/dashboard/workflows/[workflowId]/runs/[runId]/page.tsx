'use client';

import { useParams } from 'next/navigation';
import { ExecutionView } from '@/components/workflows/ExecutionView';

export default function WorkflowRunExecutionPage() {
  const params = useParams();
  const workflowId = params.workflowId as string;
  const runId = params.runId as string;

  if (!workflowId || !runId) {
    return (
      <div className="p-8 text-center text-slate-400">
        Invalid workflow or run identifier.
      </div>
    );
  }

  return (
    <div className="p-6">
      <ExecutionView workflowId={workflowId} runId={runId} />
    </div>
  );
}
