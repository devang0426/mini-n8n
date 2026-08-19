/**
 * AI Agent Workflow Builder — Workflow Execution Engine Core (Phase 4A)
 * Deterministic server-side workflow executor.
 */

import { ExecutionRequest, ExecutionResult, StepContext, ResumeData } from './types';
import {
  WorkflowNotFoundError,
  MismatchedOrgError,
  InactiveWorkflowError,
  QuotaExhaustedError,
  StateTransitionError,
  ExecutorError
} from './errors';
import { RunStateMachine } from './state-machine';
import { StepRunner } from './step-runner';
import { sanitizeText, sanitizeObject } from './sanitizer';

export class WorkflowExecutor {
  constructor(private readonly adminSqlFn: (sql: string) => Promise<any>) {}

  /**
   * Primary entry point for starting a workflow execution.
   */
  public async executeWorkflow(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!request.workflow_id || !request.org_id) {
      throw new ExecutorError('workflow_id and org_id are required for execution.');
    }

    // 1. Load Workflow Definition & Verify Org / Active Status
    const wfRes = await this.adminSqlFn(`
      SELECT id, org_id, name, is_active
      FROM public.workflows
      WHERE id = '${request.workflow_id}';
    `);

    const wfRow = wfRes.body?.result?.[1];
    if (!wfRow) {
      throw new WorkflowNotFoundError(request.workflow_id);
    }

    const [wfId, wfOrgId, wfName, isActiveStr] = wfRow;
    const isActive = isActiveStr === 't' || isActiveStr === true || isActiveStr === 'true';

    if (wfOrgId !== request.org_id) {
      throw new MismatchedOrgError(request.org_id, wfOrgId);
    }

    if (!isActive) {
      throw new InactiveWorkflowError(request.workflow_id);
    }

    // 2. Concurrency-Safe Quota Check at Start (Correction 1)
    // Lock organization row with FOR UPDATE & query active runs (pending + running)
    const orgDetRes = await this.adminSqlFn(`SELECT quota_limit, quota_used FROM public.organizations WHERE id = '${request.org_id}' FOR UPDATE;`);
    const orgRow = orgDetRes.body?.result?.[1];
    if (!orgRow) {
      throw new ExecutorError(`Organization '${request.org_id}' not found.`);
    }

    const quotaLimit = parseInt(orgRow[0] || '100', 10);
    const quotaUsed = parseInt(orgRow[1] || '0', 10);

    const activeRunsRes = await this.adminSqlFn(`SELECT COUNT(*) FROM public.workflow_runs WHERE org_id = '${request.org_id}' AND status IN ('pending', 'running');`);
    const activeRunsStr = activeRunsRes.body?.result?.[1]?.[0] || '0';
    const activeRuns = parseInt(activeRunsStr, 10);

    if ((quotaUsed + activeRuns) >= quotaLimit) {
      throw new QuotaExhaustedError(request.org_id);
    }

    // 3. Create Workflow Run (Initial Status: pending)
    const inputJson = JSON.stringify(sanitizeObject(request.input || {})).replace(/'/g, "''");
    const createRunSql = `
      INSERT INTO public.workflow_runs (
        workflow_id,
        org_id,
        status,
        trigger_type,
        input
      ) VALUES (
        '${request.workflow_id}',
        '${request.org_id}',
        'pending',
        '${request.trigger_type || 'manual'}',
        '${inputJson}'::jsonb
      ) RETURNING id;
    `;

    const createRunRes = await this.adminSqlFn(createRunSql);
    const runId = createRunRes.body?.result?.[1]?.[0];
    if (!runId) {
      throw new ExecutorError('Failed to create workflow_run record.');
    }

    // 4. Atomic Transition: pending -> running
    const startTransitionSql = RunStateMachine.getAtomicTransitionSql(runId, 'pending', 'running');
    const startRes = await this.adminSqlFn(startTransitionSql);
    if (!startRes.body?.result?.[1]) {
      throw new StateTransitionError(`Concurrent execution guard: Run '${runId}' could not transition from pending to running.`);
    }

    // Record Audit Log: workflow.execution_started
    await this.recordAuditLog(request.org_id, request.actor_id, 'workflow.execution_started', 'workflow_run', runId);

    // 5. Load Workflow Steps (ordered by position ASC)
    const stepsSql = `
      SELECT id, position, step_type, config
      FROM public.workflow_steps
      WHERE workflow_id = '${request.workflow_id}'
      ORDER BY position ASC;
    `;
    const stepsRes = await this.adminSqlFn(stepsSql);
    const stepRows = (stepsRes.body?.result || []).slice(1); // skip headers

    return this.runStepSequence(runId, request.org_id, stepRows, request.input || {}, 0);
  }

  /**
   * Resumes a paused workflow run starting from the step following the approval_gate.
   */
  public async resumeWorkflowRun(runId: string, resumeData: ResumeData): Promise<ExecutionResult> {
    // 1. Verify workflow_run status is 'paused'
    const runSql = `SELECT id, workflow_id, org_id, status, input FROM public.workflow_runs WHERE id = '${runId}';`;
    const runRes = await this.adminSqlFn(runSql);
    const runRow = runRes.body?.result?.[1];
    if (!runRow) {
      throw new ExecutorError(`Workflow run '${runId}' not found.`);
    }

    const [id, workflowId, orgId, status, inputStr] = runRow;
    if (status !== 'paused') {
      throw new StateTransitionError(`Cannot resume workflow_run '${runId}' with status '${status}'. Must be 'paused'.`);
    }

    // 2. Atomic Transition: paused -> running
    const resumeTransitionSql = RunStateMachine.getAtomicTransitionSql(runId, 'paused', 'running');
    const resumeTransRes = await this.adminSqlFn(resumeTransitionSql);
    if (!resumeTransRes.body?.result?.[1]) {
      throw new StateTransitionError(`Run '${runId}' could not transition from paused to running.`);
    }

    // 3. Find the paused step_run
    const srunSql = `
      SELECT sr.id, sr.workflow_step_id, ws.position
      FROM public.step_runs sr
      JOIN public.workflow_steps ws ON sr.workflow_step_id = ws.id
      WHERE sr.workflow_run_id = '${runId}' AND sr.status = 'paused';
    `;
    const srunRes = await this.adminSqlFn(srunSql);
    const pausedSrunRow = srunRes.body?.result?.[1];
    if (!pausedSrunRow) {
      throw new ExecutorError(`No paused step_run found for workflow_run '${runId}'.`);
    }

    const [pausedStepRunId, pausedStepId, pausedPositionStr] = pausedSrunRow;
    const pausedPosition = parseInt(pausedPositionStr, 10);

    // If Approval Denied by user
    if (resumeData.approved === false) {
      const failReason = sanitizeText('Approval denied by user.');
      await this.adminSqlFn(`
        UPDATE public.step_runs
        SET status = 'failed', error = '${failReason}', updated_at = now()
        WHERE id = '${pausedStepRunId}';
      `);

      await this.adminSqlFn(`
        UPDATE public.workflow_runs
        SET status = 'failed', error = '${failReason}', completed_at = now(), updated_at = now()
        WHERE id = '${runId}';
      `);

      await this.recordAuditLog(orgId, resumeData.approver_id, 'workflow.failed', 'workflow_run', runId, { reason: 'approval_denied' });

      return {
        workflow_run_id: runId,
        status: 'failed',
        error: failReason
      };
    }

    // Approval Approved: Update step_run status to completed
    const approverClause = resumeData.approver_id ? `, approved_by = '${resumeData.approver_id}'` : '';
    const outputJson = JSON.stringify(sanitizeObject(resumeData.output || { approved: true })).replace(/'/g, "''");
    await this.adminSqlFn(`
      UPDATE public.step_runs
      SET status = 'completed', approved_at = now()${approverClause}, output = '${outputJson}'::jsonb, updated_at = now()
      WHERE id = '${pausedStepRunId}';
    `);

    // 4. Load remaining steps (position > pausedPosition)
    const remainingStepsSql = `
      SELECT id, position, step_type, config
      FROM public.workflow_steps
      WHERE workflow_id = '${workflowId}' AND position > ${pausedPosition}
      ORDER BY position ASC;
    `;
    const remStepsRes = await this.adminSqlFn(remainingStepsSql);
    const remStepRows = (remStepsRes.body?.result || []).slice(1);

    let parsedInput = {};
    try { parsedInput = JSON.parse(inputStr || '{}'); } catch { }

    return this.runStepSequence(runId, orgId, remStepRows, parsedInput, 0);
  }

  /**
   * Internal sequential step runner loop.
   */
  private async runStepSequence(
    runId: string,
    orgId: string,
    stepRows: any[],
    initialInput: Record<string, unknown>,
    startIndex: number
  ): Promise<ExecutionResult> {
    let previousOutput = initialInput;
    let isBranchSkipping = false;

    for (let i = startIndex; i < stepRows.length; i++) {
      const [stepId, posStr, stepType, configStr] = stepRows[i];

      let config = {};
      try { config = JSON.parse(configStr || '{}'); } catch { }

      // Check if branch skipping is active
      if (isBranchSkipping) {
        await this.adminSqlFn(`
          INSERT INTO public.step_runs (
            workflow_run_id, workflow_step_id, status, attempt_count
          ) VALUES (
            '${runId}', '${stepId}', 'skipped', 1
          ) ON CONFLICT (workflow_run_id, workflow_step_id)
          DO UPDATE SET status = 'skipped', updated_at = now();
        `);
        continue;
      }

      // Create / Upsert Step Run (Status: pending)
      const initSrunRes = await this.adminSqlFn(`
        INSERT INTO public.step_runs (
          workflow_run_id, workflow_step_id, status, attempt_count
        ) VALUES (
          '${runId}', '${stepId}', 'pending', 1
        ) ON CONFLICT (workflow_run_id, workflow_step_id)
        DO UPDATE SET status = 'pending', updated_at = now()
        RETURNING id;
      `);
      const stepRunId = initSrunRes.body?.result?.[1]?.[0];

      // Update Step Run Status: running
      await this.adminSqlFn(`
        UPDATE public.step_runs
        SET status = 'running', started_at = now(), updated_at = now()
        WHERE id = '${stepRunId}';
      `);

      // Retry Loop (max 2 attempts: 1 initial + 1 retry)
      let attemptCount = 1;
      let runnerResult: any = null;
      let stepError: Error | null = null;

      while (attemptCount <= 2) {
        try {
          const stepContext: StepContext = {
            workflowInput: initialInput,
            previousOutput,
            stepConfig: config,
            workflowRunId: runId,
            stepRunId,
            orgId,
            attemptCount
          };

          runnerResult = await StepRunner.executeStep(stepType, stepContext, this.adminSqlFn);
          stepError = null;
          break; // Success! Exit retry loop.
        } catch (err: any) {
          stepError = err;
          const isRetryable = err.isRetryable === true;
          if (isRetryable && attemptCount < 2) {
            attemptCount++;
            await this.adminSqlFn(`
              UPDATE public.step_runs
              SET attempt_count = ${attemptCount}, updated_at = now()
              WHERE id = '${stepRunId}';
            `);
            await new Promise(r => setTimeout(r, 200)); // Brief retry delay
          } else {
            break; // Max attempts reached or non-retryable
          }
        }
      }

      // Handle Step Error (Unrecoverable Failure)
      if (stepError) {
        const sanitizedErrMessage = sanitizeText(stepError.message);

        await this.adminSqlFn(`
          UPDATE public.step_runs
          SET status = 'failed', error = '${sanitizedErrMessage.replace(/'/g, "''")}', completed_at = now(), updated_at = now()
          WHERE id = '${stepRunId}';
        `);

        // Fail Workflow Run
        await this.adminSqlFn(`
          UPDATE public.workflow_runs
          SET status = 'failed', error = '${sanitizedErrMessage.replace(/'/g, "''")}', completed_at = now(), updated_at = now()
          WHERE id = '${runId}';
        `);

        await this.recordAuditLog(orgId, undefined, 'workflow.failed', 'workflow_run', runId, { error: sanitizedErrMessage });

        return {
          workflow_run_id: runId,
          status: 'failed',
          error: sanitizedErrMessage
        };
      }

      // Handle Approval Gate Pause
      if (runnerResult.status === 'paused') {
        await this.adminSqlFn(`
          UPDATE public.step_runs
          SET status = 'paused', updated_at = now()
          WHERE id = '${stepRunId}';
        `);

        await this.adminSqlFn(`
          UPDATE public.workflow_runs
          SET status = 'paused', updated_at = now()
          WHERE id = '${runId}';
        `);

        await this.recordAuditLog(orgId, undefined, 'workflow.paused', 'workflow_run', runId, { pausedAtStepId: stepId });

        return {
          workflow_run_id: runId,
          status: 'paused',
          paused_at_step_id: stepId
        };
      }

      // Handle Completed Step
      const outputJson = JSON.stringify(sanitizeObject(runnerResult.output || {})).replace(/'/g, "''");
      await this.adminSqlFn(`
        UPDATE public.step_runs
        SET status = 'completed', output = '${outputJson}'::jsonb, completed_at = now(), updated_at = now()
        WHERE id = '${stepRunId}';
      `);

      if (stepType === 'conditional_branch' && runnerResult.branchTaken === 'false') {
        isBranchSkipping = true;
      }

      previousOutput = runnerResult.output || previousOutput;
    }

    // 6. Workflow Completed Successfully!
    // Transition status to completed
    await this.adminSqlFn(`
      UPDATE public.workflow_runs
      SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = '${runId}';
    `);

    // Atomically increment quota_used on successful completion (Correction 1)
    await this.adminSqlFn(`
      UPDATE public.organizations
      SET quota_used = quota_used + 1, updated_at = now()
      WHERE id = '${orgId}' AND quota_used < quota_limit;
    `);

    await this.recordAuditLog(orgId, undefined, 'workflow.completed', 'workflow_run', runId);

    return {
      workflow_run_id: runId,
      status: 'completed',
      output: sanitizeObject(previousOutput)
    };
  }

  /**
   * Helper to write sanitized audit logs.
   */
  private async recordAuditLog(
    orgId: string,
    actorId: string | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const actorClause = actorId ? `'${actorId}'` : 'NULL';
    const metaJson = JSON.stringify(sanitizeObject(metadata || {})).replace(/'/g, "''");

    const sql = `
      INSERT INTO public.audit_logs (
        org_id, actor_id, action, resource_type, resource_id, metadata
      ) VALUES (
        '${orgId}', ${actorClause}, '${action}', '${resourceType}', '${resourceId}', '${metaJson}'::jsonb
      );
    `;

    try {
      await this.adminSqlFn(sql);
    } catch {
      // Non-blocking audit log recording
    }
  }
}
