/**
 * AI Agent Workflow Builder — Hasura Actions Handler (Phase 5)
 * Securely exposes the workflow executor via triggerWorkflowRun and approveStep Actions.
 */

import { WorkflowExecutor } from './executor';
import {
  WorkflowNotFoundError,
  InactiveWorkflowError,
  QuotaExhaustedError,
  StateTransitionError,
  ExecutorError,
} from './errors';
import { sanitizeText } from './sanitizer';

export interface TriggerWorkflowActionParams {
  workflow_id: string;
  callerUserId?: string;
}

export interface ApproveStepActionParams {
  workflow_run_id: string;
  step_run_id: string;
  approved: boolean;
  callerUserId?: string;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  workflow_run_id?: string;
  step_run_id?: string;
  status?: string;
  error?: string;
  code?: string;
  message?: string;
  output?: T;
}

export class ActionError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ActionProcessor {
  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly adminSqlFn: (sql: string) => Promise<any>
  ) {}

  /**
   * Action 1: triggerWorkflowRun(workflow_id)
   * Securely triggers workflow execution for authorized owner/editor org members.
   */
  public async triggerWorkflowRun(params: TriggerWorkflowActionParams): Promise<ActionResponse> {
    const { workflow_id, callerUserId } = params;

    // 1. Authenticate caller
    if (!callerUserId || callerUserId.trim() === '' || callerUserId === 'anonymous') {
      throw new ActionError('Unauthenticated request: User identity is required.', 'UNAUTHENTICATED', 401);
    }

    // 2. Validate input
    if (!workflow_id) {
      throw new ActionError('workflow_id is required.', 'INVALID_INPUT', 400);
    }

    // 3. Load workflow
    const wfRes = await this.adminSqlFn(`
      SELECT id, org_id, name, is_active
      FROM public.workflows
      WHERE id = '${workflow_id}';
    `);

    const wfRow = wfRes.body?.result?.[1];
    if (!wfRow) {
      throw new WorkflowNotFoundError(workflow_id);
    }

    const [wfId, orgId, wfName, isActiveStr] = wfRow;
    const isActive = isActiveStr === 't' || isActiveStr === true || isActiveStr === 'true';

    // 4. Derive org & Verify caller membership + role in org_members
    const memRes = await this.adminSqlFn(`
      SELECT role
      FROM public.org_members
      WHERE org_id = '${orgId}' AND user_id = '${callerUserId}';
    `);

    const memRow = memRes.body?.result?.[1];
    if (!memRow) {
      throw new ActionError(
        `Access denied: User '${callerUserId}' is not a member of organization '${orgId}'.`,
        'CROSS_ORG_ACCESS_DENIED',
        403
      );
    }

    const role = memRow[0];

    // 5. Enforce role requirements: owner OR editor required. viewer MUST be rejected.
    if (role === 'viewer') {
      throw new ActionError(
        `Access denied: Viewers cannot trigger workflow execution. Required role: owner or editor.`,
        'VIEWER_NOT_PERMITTED',
        403
      );
    }

    if (role !== 'owner' && role !== 'editor') {
      throw new ActionError(
        `Access denied: User role '${role}' is not authorized to trigger workflow execution.`,
        'UNAUTHORIZED_ROLE',
        403
      );
    }

    // 6. Verify workflow active status
    if (!isActive) {
      throw new InactiveWorkflowError(workflow_id);
    }

    // 7. Execute via Phase 4A Executor (quota check & concurrency safety handled inside)
    const result = await this.executor.executeWorkflow({
      workflow_id,
      org_id: orgId,
      trigger_type: 'manual',
      actor_id: callerUserId,
    });

    const isSuccess = result.status !== 'failed';
    return {
      success: isSuccess,
      workflow_run_id: result.workflow_run_id,
      status: result.status,
      error: result.error ? sanitizeText(result.error) : undefined,
      message: result.error ? sanitizeText(result.error) : `Workflow run executed with status '${result.status}'.`,
      output: result.output,
    };
  }

  /**
   * Action 2: approveStep(workflow_run_id, step_run_id, approved)
   * Approves or denies a paused approval_gate step run for authorized owner/editor org members.
   */
  public async approveStep(params: ApproveStepActionParams): Promise<ActionResponse> {
    const { workflow_run_id, step_run_id, approved, callerUserId } = params;

    // 1. Authenticate caller
    if (!callerUserId || callerUserId.trim() === '' || callerUserId === 'anonymous') {
      throw new ActionError('Unauthenticated request: User identity is required.', 'UNAUTHENTICATED', 401);
    }

    // 2. Validate input
    if (!workflow_run_id || !step_run_id || typeof approved !== 'boolean') {
      throw new ActionError('workflow_run_id, step_run_id, and approved boolean flag are required.', 'INVALID_INPUT', 400);
    }

    // 3. Load workflow_run
    const runRes = await this.adminSqlFn(`
      SELECT id, workflow_id, org_id, status
      FROM public.workflow_runs
      WHERE id = '${workflow_run_id}';
    `);

    const runRow = runRes.body?.result?.[1];
    if (!runRow) {
      throw new ActionError(`Workflow run '${workflow_run_id}' not found.`, 'WORKFLOW_RUN_NOT_FOUND', 404);
    }

    const [runId, workflowId, orgId, runStatus] = runRow;

    // 4. Derive org & Verify caller membership + role in org_members
    const memRes = await this.adminSqlFn(`
      SELECT role
      FROM public.org_members
      WHERE org_id = '${orgId}' AND user_id = '${callerUserId}';
    `);

    const memRow = memRes.body?.result?.[1];
    if (!memRow) {
      throw new ActionError(
        `Access denied: User '${callerUserId}' is not a member of organization '${orgId}'.`,
        'CROSS_ORG_ACCESS_DENIED',
        403
      );
    }

    const role = memRow[0];

    // 5. Enforce role requirements: owner OR editor required. viewer MUST be rejected.
    if (role === 'viewer') {
      throw new ActionError(
        `Access denied: Viewers cannot approve workflow steps. Required role: owner or editor.`,
        'VIEWER_NOT_PERMITTED',
        403
      );
    }

    if (role !== 'owner' && role !== 'editor') {
      throw new ActionError(
        `Access denied: User role '${role}' is not authorized to approve workflow steps.`,
        'UNAUTHORIZED_ROLE',
        403
      );
    }

    // 6. Load specified step_run and its workflow_step
    const srunRes = await this.adminSqlFn(`
      SELECT sr.id, sr.workflow_run_id, sr.workflow_step_id, sr.status, sr.approved_at, ws.step_type
      FROM public.step_runs sr
      JOIN public.workflow_steps ws ON sr.workflow_step_id = ws.id
      WHERE sr.id = '${step_run_id}';
    `);

    const srunRow = srunRes.body?.result?.[1];
    if (!srunRow) {
      throw new ActionError(`Step run '${step_run_id}' not found.`, 'STEP_RUN_NOT_FOUND', 404);
    }

    const [srunId, srunRunId, srunStepId, srunStatus, srunApprovedAt, stepType] = srunRow;

    // 7. Verify step_run belongs to workflow_run
    if (srunRunId !== workflow_run_id) {
      throw new ActionError(
        `Step run '${step_run_id}' does not belong to workflow run '${workflow_run_id}'.`,
        'STEP_RUN_MISMATCH',
        400
      );
    }

    // 8. Verify workflow_step is approval_gate
    if (stepType !== 'approval_gate') {
      throw new ActionError(
        `Step '${step_run_id}' is of step_type '${stepType}', not an approval_gate.`,
        'NOT_APPROVAL_GATE',
        400
      );
    }

    // 9. Verify workflow_run.status is paused
    if (runStatus !== 'paused') {
      throw new StateTransitionError(
        `Workflow run '${workflow_run_id}' is not in paused state (current status: '${runStatus}').`
      );
    }

    // 10. Verify approval gate has not already been approved/processed
    const isAlreadyApproved = srunApprovedAt && srunApprovedAt !== 'NULL' && srunApprovedAt !== '';
    if (srunStatus !== 'paused' || isAlreadyApproved) {
      throw new ActionError(
        `Approval gate step run '${step_run_id}' has already been processed or is not paused (current status: '${srunStatus}').`,
        'APPROVAL_ALREADY_PROCESSED',
        400
      );
    }

    // 11. Execute resume via Phase 4A Executor (resumes from paused step, does not restart from step 1)
    const result = await this.executor.resumeWorkflowRun(workflow_run_id, {
      approved,
      approver_id: callerUserId,
    });

    // If approved = false, record approved_by on the failed step_run as well
    if (!approved) {
      await this.adminSqlFn(`
        UPDATE public.step_runs
        SET approved_by = '${callerUserId}', updated_at = now()
        WHERE id = '${step_run_id}';
      `);
    }

    const isSuccess = result.status !== 'failed';
    return {
      success: isSuccess,
      workflow_run_id,
      step_run_id,
      status: result.status,
      error: result.error ? sanitizeText(result.error) : undefined,
      message: result.error
        ? sanitizeText(result.error)
        : `Approval gate step run '${step_run_id}' ${approved ? 'approved' : 'denied'} successfully with workflow status '${result.status}'.`,
      output: result.output,
    };
  }
}
