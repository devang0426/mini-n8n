/**
 * Workflow Lifecycle & Duplication Operations (Phase P2)
 */

import { executeGraphQL } from '@/lib/graphql/client';
import { GET_WORKFLOW_BY_ID } from '@/graphql/workflows/queries';
import { CREATE_WORKFLOW, UPDATE_WORKFLOW, DELETE_WORKFLOW } from '@/graphql/workflows/mutations';
import { CREATE_WORKFLOW_STEP } from '@/graphql/steps/mutations';
import { CREATE_WORKFLOW_TRIGGER } from '@/graphql/triggers/mutations';

export interface StepData {
  id: string;
  position: number;
  step_type: string;
  config: Record<string, unknown>;
}

export interface TriggerData {
  id: string;
  trigger_type: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
}

export interface FullWorkflowDetail {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  steps: StepData[];
  triggers: TriggerData[];
}

/**
 * Sanitizes step configuration before duplication to ensure sensitive credentials are stripped.
 */
function sanitizeStepConfigForDuplication(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const cleaned: Record<string, unknown> = { ...config };

  // Keys to strip/clear during duplication for security
  const SENSITIVE_KEYS = [
    'api_key',
    'apikey',
    'secret',
    'secret_key',
    'token',
    'auth_token',
    'authorization',
    'bearer_token',
    'password',
    'credentials',
    'private_key',
  ];

  for (const key of Object.keys(cleaned)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      delete cleaned[key];
    }
  }

  return cleaned;
}

/**
 * Sanitizes trigger configuration before duplication.
 */
function sanitizeTriggerConfigForDuplication(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const cleaned: Record<string, unknown> = { ...config };

  // Strip trigger secrets if any
  delete cleaned.secret;
  delete cleaned.webhook_secret;
  delete cleaned.token;

  return cleaned;
}

/**
 * Renames a workflow after validating name format.
 */
export async function renameWorkflow(
  accessToken: string,
  workflowId: string,
  newName: string
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('Workflow name cannot be empty.');
  }
  if (trimmed.length > 100) {
    throw new Error('Workflow name must be 100 characters or fewer.');
  }

  await executeGraphQL(accessToken, UPDATE_WORKFLOW, {
    id: workflowId,
    name: trimmed,
  });
}

/**
 * Toggles the is_active status of a workflow.
 */
export async function toggleWorkflowActive(
  accessToken: string,
  workflowId: string,
  isActive: boolean
): Promise<void> {
  await executeGraphQL(accessToken, UPDATE_WORKFLOW, {
    id: workflowId,
    is_active: isActive,
  });
}

/**
 * Duplicates a workflow definition inside the user's authorized organization.
 * Does NOT duplicate execution history, workflow_runs, step_runs, or sensitive secrets.
 */
export async function duplicateWorkflow(
  accessToken: string,
  sourceWorkflowId: string,
  activeOrgId: string
): Promise<string> {
  // 1. Query source workflow definition via Hasura (enforces org-scoping & access control)
  const data = await executeGraphQL<{ workflows_by_pk: FullWorkflowDetail | null }>(
    accessToken,
    GET_WORKFLOW_BY_ID,
    { id: sourceWorkflowId }
  );

  const sourceWf = data.workflows_by_pk;
  if (!sourceWf) {
    throw new Error('Source workflow not found or access denied in this organization.');
  }

  // Cross-org security check: Ensure source workflow belongs to user's active org
  if (sourceWf.org_id !== activeOrgId) {
    throw new Error('Unauthorized: Cannot duplicate a workflow from another organization.');
  }

  // 2. Create Duplicate Workflow Header
  const duplicateName = `${sourceWf.name} (Copy)`;
  const createRes = await executeGraphQL<{ insert_workflows_one: { id: string } }>(
    accessToken,
    CREATE_WORKFLOW,
    {
      org_id: activeOrgId,
      name: duplicateName,
      description: sourceWf.description || null,
      is_active: false, // Default duplicates to inactive so user can review before enabling
    }
  );

  const newWfId = createRes.insert_workflows_one?.id;
  if (!newWfId) {
    throw new Error('Failed to create duplicate workflow instance.');
  }

  // 3. Duplicate Steps (Ordered by position)
  const steps = sourceWf.steps || [];
  const sortedSteps = [...steps].sort((a, b) => a.position - b.position);

  for (const step of sortedSteps) {
    const sanitizedConfig = sanitizeStepConfigForDuplication(step.config);
    await executeGraphQL(accessToken, CREATE_WORKFLOW_STEP, {
      workflow_id: newWfId,
      position: step.position,
      step_type: step.step_type,
      config: sanitizedConfig,
    });
  }

  // 4. Duplicate Triggers (Sanitized)
  const triggers = sourceWf.triggers || [];
  for (const trigger of triggers) {
    const sanitizedConfig = sanitizeTriggerConfigForDuplication(trigger.config);
    await executeGraphQL(accessToken, CREATE_WORKFLOW_TRIGGER, {
      workflow_id: newWfId,
      trigger_type: trigger.trigger_type,
      config: sanitizedConfig,
      is_enabled: trigger.is_enabled,
    });
  }

  return newWfId;
}

/**
 * Deletes a workflow. Cascade constraints in PostgreSQL handle deleting step and trigger children.
 */
export async function deleteWorkflow(
  accessToken: string,
  workflowId: string
): Promise<void> {
  await executeGraphQL(accessToken, DELETE_WORKFLOW, { id: workflowId });
}
