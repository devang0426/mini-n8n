/**
 * Hasura Actions Frontend Client Helpers (Phase 6C)
 * Calls triggerWorkflowRun and approveStep Hasura Actions using authenticated Nhost JWT.
 * Never exposes Hasura admin secret or passes manual user/role authorization claims.
 */

import { executeGraphQL } from './client';

export const TRIGGER_WORKFLOW_RUN_MUTATION = `
  mutation TriggerWorkflowRun($workflow_id: uuid!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      success
      workflow_run_id
      status
      error
      message
    }
  }
`;

export const APPROVE_STEP_MUTATION = `
  mutation ApproveStep($workflow_run_id: uuid!, $step_run_id: uuid!, $approved: Boolean!) {
    approveStep(
      workflow_run_id: $workflow_run_id
      step_run_id: $step_run_id
      approved: $approved
    ) {
      success
      workflow_run_id
      step_run_id
      status
      error
      message
    }
  }
`;

export interface TriggerWorkflowResult {
  success: boolean;
  workflow_run_id?: string;
  status?: string;
  error?: string;
  message?: string;
}

export interface ApproveStepResult {
  success: boolean;
  workflow_run_id?: string;
  step_run_id?: string;
  status?: string;
  error?: string;
  message?: string;
}

function resolveApiUrl(path: string): string {
  if (typeof window !== 'undefined') return path;
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}${path}`;
}

function parseUserIdFromJwt(jwtToken: string): string | undefined {
  try {
    const parts = jwtToken.split('.');
    if (parts.length === 3) {
      const payloadStr = typeof window !== 'undefined' ? atob(parts[1]) : Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      return payload.sub || payload['https://hasura.io/jwt/claims']?.['x-hasura-user-id'];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Triggers a workflow execution via Hasura Action or Action Endpoint fallback.
 */
export async function triggerWorkflowRunAction(
  jwtToken: string,
  workflowId: string
): Promise<TriggerWorkflowResult> {
  if (!jwtToken) {
    throw new Error('Authentication required to run workflow.');
  }
  if (!workflowId) {
    throw new Error('Workflow ID is required.');
  }

  try {
    const data = await executeGraphQL<{ triggerWorkflowRun: TriggerWorkflowResult }>(
      jwtToken,
      TRIGGER_WORKFLOW_RUN_MUTATION,
      { workflow_id: workflowId }
    );

    const res = data.triggerWorkflowRun;
    if (!res.success) {
      throw new Error(res.error || res.message || 'Failed to trigger workflow execution.');
    }
    return res;
  } catch (err: any) {
    // If GraphQL action is not registered in Hasura engine schema, fallback to Action API Route or Direct Processor
    if (err.message && err.message.includes('not found in type')) {
      const endpoint = resolveApiUrl('/api/actions/trigger-workflow');
      const callerUserId = parseUserIdFromJwt(jwtToken);
      const actionPayload = {
        input: { workflow_id: workflowId },
        session_variables: callerUserId ? { 'x-hasura-user-id': callerUserId } : undefined,
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(actionPayload),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || json.message || 'Failed to trigger workflow execution.');
        }
        return json;
      } catch (fetchErr: any) {
        // Node environment fallback when local server is not listening
        if (typeof window === 'undefined') {
          const { POST } = await import('@/app/api/actions/trigger-workflow/route');
          const { NextRequest } = await import('next/server');
          const req = new NextRequest(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${jwtToken}` },
            body: JSON.stringify(actionPayload),
          });
          const res = await POST(req);
          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || json.message || 'Failed to trigger workflow execution.');
          }
          return json;
        }
        throw fetchErr;
      }
    }
    throw err;
  }
}

/**
 * Approves or rejects a paused step run via Hasura Action or Action Endpoint fallback.
 */
export async function approveStepAction(
  jwtToken: string,
  workflowRunId: string,
  stepRunId: string,
  approved: boolean
): Promise<ApproveStepResult> {
  if (!jwtToken) {
    throw new Error('Authentication required to approve step.');
  }
  if (!workflowRunId || !stepRunId) {
    throw new Error('Workflow run ID and step run ID are required.');
  }

  try {
    const data = await executeGraphQL<{ approveStep: ApproveStepResult }>(
      jwtToken,
      APPROVE_STEP_MUTATION,
      {
        workflow_run_id: workflowRunId,
        step_run_id: stepRunId,
        approved,
      }
    );

    const res = data.approveStep;
    if (!res.success) {
      throw new Error(res.error || res.message || 'Failed to process step approval.');
    }
    return res;
  } catch (err: any) {
    if (err.message && err.message.includes('not found in type')) {
      const endpoint = resolveApiUrl('/api/actions/approve-step');
      const callerUserId = parseUserIdFromJwt(jwtToken);
      const actionPayload = {
        input: {
          workflow_run_id: workflowRunId,
          step_run_id: stepRunId,
          approved,
        },
        session_variables: callerUserId ? { 'x-hasura-user-id': callerUserId } : undefined,
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(actionPayload),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || json.message || 'Failed to process step approval.');
        }
        return json;
      } catch (fetchErr: any) {
        if (typeof window === 'undefined') {
          const { POST } = await import('@/app/api/actions/approve-step/route');
          const { NextRequest } = await import('next/server');
          const req = new NextRequest(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${jwtToken}` },
            body: JSON.stringify(actionPayload),
          });
          const res = await POST(req);
          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || json.message || 'Failed to process step approval.');
          }
          return json;
        }
        throw fetchErr;
      }
    }
    throw err;
  }
}
