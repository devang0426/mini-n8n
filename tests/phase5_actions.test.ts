/**
 * AI Agent Workflow Builder — Phase 5 Hasura Actions & Approval Execution Test Suite
 */

import { WorkflowExecutor } from '../server/workflow/executor';
import { ActionProcessor, ActionError } from '../server/workflow/actions';
import { sanitizeText } from '../server/workflow/sanitizer';
import {
  WorkflowNotFoundError,
  InactiveWorkflowError,
  QuotaExhaustedError,
  StateTransitionError
} from '../server/workflow/errors';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runPhase5Tests(
  executor: WorkflowExecutor,
  adminSqlFn: (sql: string) => Promise<any>,
  ids: {
    orgA_id: string;
    orgB_id: string;
    orgQuota_id: string;
    ownerA_id: string;
    editorA_id: string;
    viewerA_id: string;
    ownerB_id: string;
    viewerB_id: string;
    wfA_id: string;
    wfInactive_id: string;
    wfQuota_id: string;
    wfApproval_id: string;
    wfApproval2_id: string;
  }
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const processor = new ActionProcessor(executor, adminSqlFn);

  function assert(name: string, passed: boolean, message = '') {
    results.push({ name, passed, message });
  }

  // ==========================================
  // triggerWorkflowRun Tests (1 - 9)
  // ==========================================

  // 1. ownerA can trigger Org A workflow
  try {
    const res = await processor.triggerWorkflowRun({
      workflow_id: ids.wfA_id,
      callerUserId: ids.ownerA_id,
    });
    assert('1. ownerA can trigger Org A workflow', res.success && res.status === 'completed' && !!res.workflow_run_id);
  } catch (err: any) {
    assert('1. ownerA can trigger Org A workflow', false, err.message);
  }

  // 2. editorA can trigger Org A workflow
  try {
    const res = await processor.triggerWorkflowRun({
      workflow_id: ids.wfA_id,
      callerUserId: ids.editorA_id,
    });
    assert('2. editorA can trigger Org A workflow', res.success && res.status === 'completed' && !!res.workflow_run_id);
  } catch (err: any) {
    assert('2. editorA can trigger Org A workflow', false, err.message);
  }

  // 3. viewerA cannot trigger Org A workflow
  try {
    await processor.triggerWorkflowRun({
      workflow_id: ids.wfA_id,
      callerUserId: ids.viewerA_id,
    });
    assert('3. viewerA cannot trigger Org A workflow', false, 'Expected VIEWER_NOT_PERMITTED error');
  } catch (err: any) {
    assert(
      '3. viewerA cannot trigger Org A workflow',
      err instanceof ActionError && (err.code === 'VIEWER_NOT_PERMITTED' || err.statusCode === 403),
      err.message
    );
  }

  // 4. ownerB cannot trigger Org A workflow
  try {
    await processor.triggerWorkflowRun({
      workflow_id: ids.wfA_id,
      callerUserId: ids.ownerB_id,
    });
    assert('4. ownerB cannot trigger Org A workflow', false, 'Expected CROSS_ORG_ACCESS_DENIED error');
  } catch (err: any) {
    assert(
      '4. ownerB cannot trigger Org A workflow',
      err instanceof ActionError && (err.code === 'CROSS_ORG_ACCESS_DENIED' || err.statusCode === 403),
      err.message
    );
  }

  // 5. ownerB cannot trigger Org A workflow by guessing UUID
  try {
    await processor.triggerWorkflowRun({
      workflow_id: ids.wfA_id,
      callerUserId: ids.ownerB_id,
    });
    assert('5. ownerB cannot trigger Org A workflow by guessing UUID', false, 'Expected CROSS_ORG_ACCESS_DENIED error');
  } catch (err: any) {
    assert(
      '5. ownerB cannot trigger Org A workflow by guessing UUID',
      err instanceof ActionError && (err.code === 'CROSS_ORG_ACCESS_DENIED' || err.statusCode === 403),
      err.message
    );
  }

  // 6. inactive workflow is rejected
  try {
    await processor.triggerWorkflowRun({
      workflow_id: ids.wfInactive_id,
      callerUserId: ids.ownerA_id,
    });
    assert('6. inactive workflow is rejected', false, 'Expected InactiveWorkflowError');
  } catch (err: any) {
    assert(
      '6. inactive workflow is rejected',
      err instanceof InactiveWorkflowError || err.code === 'INACTIVE_WORKFLOW',
      err.message
    );
  }

  // 7. quota exhaustion is rejected
  try {
    // Exhaust quota on wfQuota_id (limit 1)
    await processor.triggerWorkflowRun({ workflow_id: ids.wfQuota_id, callerUserId: ids.ownerA_id });
    await processor.triggerWorkflowRun({ workflow_id: ids.wfQuota_id, callerUserId: ids.ownerA_id });
    assert('7. quota exhaustion is rejected', false, 'Expected QuotaExhaustedError');
  } catch (err: any) {
    assert(
      '7. quota exhaustion is rejected',
      err instanceof QuotaExhaustedError || err.code === 'QUOTA_EXHAUSTED',
      err.message
    );
  }

  // 8. successful Action invokes the existing executor
  const execWfRes = await processor.triggerWorkflowRun({
    workflow_id: ids.wfA_id,
    callerUserId: ids.ownerA_id,
  });
  assert(
    '8. successful Action invokes the existing executor',
    execWfRes.success && execWfRes.status === 'completed' && !!execWfRes.workflow_run_id
  );

  // 9. workflow_run is created/updated correctly
  const dbRunCheck = (
    await adminSqlFn(`SELECT status, trigger_type FROM public.workflow_runs WHERE id = '${execWfRes.workflow_run_id}';`)
  ).body.result[1];
  assert(
    '9. workflow_run is created/updated correctly',
    dbRunCheck[0] === 'completed' && dbRunCheck[1] === 'manual'
  );


  // ==========================================
  // approveStep Tests (10 - 23)
  // ==========================================

  // Setup paused approval workflow runs for testing
  const pausedRun1 = await executor.executeWorkflow({ workflow_id: ids.wfApproval_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const pausedRun1_id = pausedRun1.workflow_run_id;
  const srun1_db = (
    await adminSqlFn(`SELECT id FROM public.step_runs WHERE workflow_run_id = '${pausedRun1_id}' AND status = 'paused';`)
  ).body.result[1];
  const stepRun1_id = srun1_db[0];

  const pausedRun2 = await executor.executeWorkflow({ workflow_id: ids.wfApproval_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const pausedRun2_id = pausedRun2.workflow_run_id;
  const srun2_db = (
    await adminSqlFn(`SELECT id FROM public.step_runs WHERE workflow_run_id = '${pausedRun2_id}' AND status = 'paused';`)
  ).body.result[1];
  const stepRun2_id = srun2_db[0];

  // 10. ownerA can approve Org A paused approval gate
  try {
    const res = await processor.approveStep({
      workflow_run_id: pausedRun1_id,
      step_run_id: stepRun1_id,
      approved: true,
      callerUserId: ids.ownerA_id,
    });
    assert('10. ownerA can approve Org A paused approval gate', res.success && res.status === 'completed');
  } catch (err: any) {
    assert('10. ownerA can approve Org A paused approval gate', false, err.message);
  }

  // 11. editorA can approve Org A paused approval gate
  try {
    const res = await processor.approveStep({
      workflow_run_id: pausedRun2_id,
      step_run_id: stepRun2_id,
      approved: true,
      callerUserId: ids.editorA_id,
    });
    assert('11. editorA can approve Org A paused approval gate', res.success && res.status === 'completed');
  } catch (err: any) {
    assert('11. editorA can approve Org A paused approval gate', false, err.message);
  }

  // 12. viewerA cannot approve
  const pausedRun3 = await executor.executeWorkflow({ workflow_id: ids.wfApproval_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const stepRun3_id = (await adminSqlFn(`SELECT id FROM public.step_runs WHERE workflow_run_id = '${pausedRun3.workflow_run_id}' AND status = 'paused';`)).body.result[1][0];
  try {
    await processor.approveStep({
      workflow_run_id: pausedRun3.workflow_run_id,
      step_run_id: stepRun3_id,
      approved: true,
      callerUserId: ids.viewerA_id,
    });
    assert('12. viewerA cannot approve', false, 'Expected VIEWER_NOT_PERMITTED error');
  } catch (err: any) {
    assert(
      '12. viewerA cannot approve',
      err instanceof ActionError && (err.code === 'VIEWER_NOT_PERMITTED' || err.statusCode === 403),
      err.message
    );
  }

  // 13. ownerB cannot approve Org A
  try {
    await processor.approveStep({
      workflow_run_id: pausedRun3.workflow_run_id,
      step_run_id: stepRun3_id,
      approved: true,
      callerUserId: ids.ownerB_id,
    });
    assert('13. ownerB cannot approve Org A', false, 'Expected CROSS_ORG_ACCESS_DENIED error');
  } catch (err: any) {
    assert(
      '13. ownerB cannot approve Org A',
      err instanceof ActionError && (err.code === 'CROSS_ORG_ACCESS_DENIED' || err.statusCode === 403),
      err.message
    );
  }

  // 14. unknown step_run is rejected
  try {
    await processor.approveStep({
      workflow_run_id: pausedRun3.workflow_run_id,
      step_run_id: '00000000-0000-0000-0000-000000000000',
      approved: true,
      callerUserId: ids.ownerA_id,
    });
    assert('14. unknown step_run is rejected', false, 'Expected STEP_RUN_NOT_FOUND error');
  } catch (err: any) {
    assert(
      '14. unknown step_run is rejected',
      err instanceof ActionError && (err.code === 'STEP_RUN_NOT_FOUND' || err.statusCode === 404),
      err.message
    );
  }

  // 15. step_run belonging to another run is rejected
  try {
    await processor.approveStep({
      workflow_run_id: pausedRun3.workflow_run_id,
      step_run_id: stepRun1_id, // belongs to pausedRun1
      approved: true,
      callerUserId: ids.ownerA_id,
    });
    assert('15. step_run belonging to another run is rejected', false, 'Expected STEP_RUN_MISMATCH error');
  } catch (err: any) {
    assert(
      '15. step_run belonging to another run is rejected',
      err instanceof ActionError && (err.code === 'STEP_RUN_MISMATCH' || err.code === 'APPROVAL_ALREADY_PROCESSED' || err.statusCode === 400),
      err.message
    );
  }

  // 16. non-approval step cannot be approved
  const nonApprovalStepRes = await adminSqlFn(`SELECT id FROM public.step_runs WHERE workflow_run_id = '${execWfRes.workflow_run_id}' LIMIT 1;`);
  const nonApprovalStepId = nonApprovalStepRes.body?.result?.[1]?.[0] || '00000000-0000-0000-0000-000000000000';
  try {
    await processor.approveStep({
      workflow_run_id: execWfRes.workflow_run_id!,
      step_run_id: nonApprovalStepId,
      approved: true,
      callerUserId: ids.ownerA_id,
    });
    assert('16. non-approval step cannot be approved', false, 'Expected NOT_APPROVAL_GATE or APPROVAL_ALREADY_PROCESSED error');
  } catch (err: any) {
    assert('16. non-approval step cannot be approved', true, err.message);
  }

  // 17. non-paused run cannot be approved
  try {
    await processor.approveStep({
      workflow_run_id: pausedRun1_id, // now completed
      step_run_id: stepRun1_id,
      approved: true,
      callerUserId: ids.ownerA_id,
    });
    assert('17. non-paused run cannot be approved', false, 'Expected StateTransitionError or RUN_NOT_PAUSED error');
  } catch (err: any) {
    assert('17. non-paused run cannot be approved', true, err.message);
  }

  // 18. already-approved gate cannot be approved again
  try {
    await processor.approveStep({
      workflow_run_id: pausedRun1_id,
      step_run_id: stepRun1_id,
      approved: true,
      callerUserId: ids.ownerA_id,
    });
    assert('18. already-approved gate cannot be approved again', false, 'Expected APPROVAL_ALREADY_PROCESSED error');
  } catch (err: any) {
    assert('18. already-approved gate cannot be approved again', true, err.message);
  }

  // 19. approval records approved_by correctly
  const appDbCheck = (
    await adminSqlFn(`SELECT approved_by, approved_at FROM public.step_runs WHERE id = '${stepRun1_id}';`)
  ).body.result[1];
  assert('19. approval records approved_by correctly', appDbCheck[0] === ids.ownerA_id);

  // 20. approval records approved_at correctly
  assert('20. approval records approved_at correctly', !!appDbCheck[1]);

  // 21 & 22. approval resumes from correct step & workflow does not restart from step 1
  const stepsRun1 = (
    await adminSqlFn(`
      SELECT sr.status, ws.position
      FROM public.step_runs sr
      JOIN public.workflow_steps ws ON sr.workflow_step_id = ws.id
      WHERE sr.workflow_run_id = '${pausedRun1_id}'
      ORDER BY ws.position ASC;
    `)
  ).body.result.slice(1);
  assert(
    '21. approval resumes from the correct step',
    stepsRun1.length >= 2 && stepsRun1[1][0] === 'completed'
  );
  assert(
    '22. workflow does not restart from step 1',
    stepsRun1[0][0] === 'completed' && stepsRun1.length <= 3
  );

  // 23. invalid state transition is rejected
  try {
    await executor.resumeWorkflowRun(pausedRun1_id, { approved: true });
    assert('23. invalid state transition is rejected', false, 'Expected StateTransitionError');
  } catch (err: any) {
    assert('23. invalid state transition is rejected', err instanceof StateTransitionError || err.code === 'INVALID_STATE_TRANSITION', err.message);
  }


  // ==========================================
  // Security Tests (24 - 26)
  // ==========================================

  // 24. No admin secret appears in client code
  const clientTsContent = fs.readFileSync(path.join(process.cwd(), 'lib/graphql/client.ts'), 'utf8');
  assert(
    '24. No admin secret appears in client code',
    !clientTsContent.includes('HASURA_GRAPHQL_ADMIN_SECRET') && !clientTsContent.includes('x-hasura-admin-secret')
  );

  // 25. No secrets appear in Action logs/errors
  const secretText = 'Error containing LLM Key AQ.Ab8RN6I9oD2BhepLqkrx1ruc and Authorization: Bearer token12345';
  const sanitized = sanitizeText(secretText);
  assert(
    '25. No secrets appear in Action logs/errors',
    !sanitized.includes('AQ.Ab8RN6I9oD2BhepLqkrx1ruc') && !sanitized.includes('token12345') && sanitized.includes('[REDACTED_SECRET]')
  );

  // 26. Anonymous Action request is rejected
  try {
    await processor.triggerWorkflowRun({
      workflow_id: ids.wfA_id,
      callerUserId: undefined,
    });
    assert('26. Anonymous Action request is rejected', false, 'Expected UNAUTHENTICATED error');
  } catch (err: any) {
    assert(
      '26. Anonymous Action request is rejected',
      err instanceof ActionError && (err.code === 'UNAUTHENTICATED' || err.statusCode === 401),
      err.message
    );
  }

  return results;
}
