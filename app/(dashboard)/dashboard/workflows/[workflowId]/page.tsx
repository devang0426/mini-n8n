'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { GET_WORKFLOW_BY_ID } from '@/graphql/workflows/queries';
import { useOrganization } from '@/hooks/useOrganization';
import { WorkflowEditor, FullWorkflowData } from '@/components/workflows/WorkflowEditor';

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const accessToken = useAccessToken();
  const { organization, isLoading: isOrgLoading } = useOrganization();

  const workflowId = params?.workflowId as string;

  const [workflow, setWorkflow] = useState<FullWorkflowData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorizedOrNotFound, setIsUnauthorizedOrNotFound] = useState<boolean>(false);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId || !accessToken || isOrgLoading) return;

    setIsLoading(true);
    setError(null);
    setIsUnauthorizedOrNotFound(false);

    try {
      const data = await executeGraphQL<{ workflows_by_pk: FullWorkflowData | null }>(
        accessToken,
        GET_WORKFLOW_BY_ID,
        { id: workflowId }
      );

      const wf = data.workflows_by_pk;

      if (!wf || (organization && wf.org_id !== organization.id)) {
        setIsUnauthorizedOrNotFound(true);
        setWorkflow(null);
      } else {
        setWorkflow(wf);
      }
    } catch (err) {
      setIsUnauthorizedOrNotFound(true);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, accessToken, organization?.id, isOrgLoading]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  if (isOrgLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center space-x-3 px-6 py-4 rounded-xl border-[2.5px] border-[#111] bg-white shadow-[4px_4px_0_#111]">
          <svg className="animate-spin h-5 w-5 text-[#111]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs font-black uppercase tracking-wider text-[#111]">Loading workflow details...</span>
        </div>
      </div>
    );
  }

  if (isUnauthorizedOrNotFound || !workflow) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] max-w-lg mx-auto my-12">
        <div className="h-16 w-16 rounded-2xl bg-[#FF6B6B] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] flex items-center justify-center text-white text-2xl font-black mb-4">
          🔒
        </div>
        <h2 className="text-2xl font-black uppercase tracking-wider text-[#111]">Workflow Not Found</h2>
        <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-2">
          The requested workflow does not exist or you do not have permission to access it in the selected organization.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
        >
          Return to Workflows
        </button>
      </div>
    );
  }

  return <WorkflowEditor initialWorkflow={workflow} />;
}
