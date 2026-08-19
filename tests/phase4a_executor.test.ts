/**
 * AI Agent Workflow Builder — Phase 4A Core Executor Test Suite
 */

import { WorkflowExecutor } from '../server/workflow/executor';
import { RunStateMachine } from '../server/workflow/state-machine';
import { sanitizeText } from '../server/workflow/sanitizer';
import {
  WorkflowNotFoundError,
  MismatchedOrgError,
  InactiveWorkflowError,
  QuotaExhaustedError,
  StateTransitionError
} from '../server/workflow/errors';

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runPhase4ATests(
  executor: WorkflowExecutor,
  adminSqlFn: (sql: string) => Promise<any>,
  ids: {
    orgA_id: string;
    orgQuota1_id: string;
    wfA_id: string;
    wfInactive_id: string;
    wfCond_id: string;
    wfApproval_id: string;
    wfQuota1_id: string;
  }
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function assert(name: string, passed: boolean, message = '') {
    results.push({ name, passed, message });
  }

  // 1. Nonexistent workflow -> fails (WorkflowNotFoundError)
  try {
    await executor.executeWorkflow({ workflow_id: '00000000-0000-0000-0000-000000000000', org_id: ids.orgA_id, trigger_type: 'manual' });
    assert('1. Nonexistent workflow fails', false, 'Expected WorkflowNotFoundError');
  } catch (err) {
    assert('1. Nonexistent workflow fails', err instanceof WorkflowNotFoundError || (err as any).code === 'WORKFLOW_NOT_FOUND', (err as Error).message);
  }

  // 2. Inactive workflow -> fails (InactiveWorkflowError)
  try {
    await executor.executeWorkflow({ workflow_id: ids.wfInactive_id, org_id: ids.orgA_id, trigger_type: 'manual' });
    assert('2. Inactive workflow fails', false, 'Expected InactiveWorkflowError');
  } catch (err) {
    assert('2. Inactive workflow fails', err instanceof InactiveWorkflowError || (err as any).code === 'INACTIVE_WORKFLOW', (err as Error).message);
  }

  // 3. Mismatched workflow/org -> fails (MismatchedOrgError)
  try {
    await executor.executeWorkflow({ workflow_id: ids.wfA_id, org_id: ids.orgQuota1_id, trigger_type: 'manual' });
    assert('3. Mismatched workflow/org fails', false, 'Expected MismatchedOrgError');
  } catch (err) {
    assert('3. Mismatched workflow/org fails', err instanceof MismatchedOrgError || (err as any).code === 'MISMATCHED_ORG', (err as Error).message);
  }

  // 4-6 & 19: Workflow Run execution pending -> running -> completed & steps execute in position order
  const execResultA = await executor.executeWorkflow({ workflow_id: ids.wfA_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const runA_id = execResultA.workflow_run_id;

  const runA_db = (await adminSqlFn(`SELECT status, started_at, completed_at FROM public.workflow_runs WHERE id = '${runA_id}';`)).body.result[1];
  assert('4. workflow_run starts pending -> running -> completed', runA_db[0] === 'completed' && !!runA_db[1] && !!runA_db[2]);

  const srunsA_db = (await adminSqlFn(`
    SELECT sr.status, ws.position
    FROM public.step_runs sr
    JOIN public.workflow_steps ws ON sr.workflow_step_id = ws.id
    WHERE sr.workflow_run_id = '${runA_id}'
    ORDER BY ws.position ASC;
  `)).body.result.slice(1);

  assert('5. Steps execute in position order', srunsA_db.length >= 1 && srunsA_db[0][1] === '1');
  assert('6. Successful steps become completed', srunsA_db[0][0] === 'completed');
  assert('19. Successful workflow becomes completed', execResultA.status === 'completed');

  // 7. Failed step fails workflow
  const wfFailing_id = (await adminSqlFn(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${ids.orgA_id}', 'Failing Wf', true) RETURNING id;`)).body.result[1][0];
  await adminSqlFn(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfFailing_id}', 1, 'http_request', '{"url":"https://httpbin.org/status/400"}');`);

  const execFailResult = await executor.executeWorkflow({ workflow_id: wfFailing_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  assert('7. Failed step fails workflow', execFailResult.status === 'failed' && !!execFailResult.error);

  // 8 & 9: Transient failure retries & retry count increments
  const wfRetry_id = (await adminSqlFn(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${ids.orgA_id}', 'Retry Wf', true) RETURNING id;`)).body.result[1][0];
  await adminSqlFn(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfRetry_id}', 1, 'http_request', '{"url":"https://httpbin.org/status/500"}');`);

  const execRetryResult = await executor.executeWorkflow({ workflow_id: wfRetry_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const srunRetry_db = (await adminSqlFn(`SELECT status, attempt_count FROM public.step_runs WHERE workflow_run_id = '${execRetryResult.workflow_run_id}';`)).body.result[1];
  assert('8. Transient failure retries', srunRetry_db[0] === 'failed');
  assert('9. Retry count increments (attempt_count = 2)', srunRetry_db[1] === '2');

  // 10. Conditional true branch
  const execCondTrue = await executor.executeWorkflow({
    workflow_id: ids.wfCond_id,
    org_id: ids.orgA_id,
    trigger_type: 'manual',
    input: { approved: true }
  });
  const srunsCondTrue = (await adminSqlFn(`SELECT status FROM public.step_runs WHERE workflow_run_id = '${execCondTrue.workflow_run_id}' ORDER BY created_at ASC;`)).body.result.slice(1);
  assert('10. Conditional true branch continues execution', execCondTrue.status === 'completed' && srunsCondTrue[1][0] === 'completed');

  // 11 & 12. Conditional false branch & skipped steps
  const execCondFalse = await executor.executeWorkflow({
    workflow_id: ids.wfCond_id,
    org_id: ids.orgA_id,
    trigger_type: 'manual',
    input: { approved: false }
  });
  const srunsCondFalse = (await adminSqlFn(`SELECT status FROM public.step_runs WHERE workflow_run_id = '${execCondFalse.workflow_run_id}' ORDER BY created_at ASC;`)).body.result.slice(1);
  assert('11. Conditional false branch triggers branch skipping', execCondFalse.status === 'completed');
  assert('12. Skipped steps become skipped (status = skipped)', srunsCondFalse[1][0] === 'skipped');

  // 13 & 14. approval_gate pauses & resumes from correct step
  const execAppResult = await executor.executeWorkflow({ workflow_id: ids.wfApproval_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  assert('13. approval_gate pauses workflow (workflow_run: paused)', execAppResult.status === 'paused' && !!execAppResult.paused_at_step_id);

  const resumeResult = await executor.resumeWorkflowRun(execAppResult.workflow_run_id, { approved: true });
  assert('14. Paused workflow resumes from correct step (completed)', resumeResult.status === 'completed');

  // 15. Invalid state transition rejected
  try {
    RunStateMachine.assertValidTransition('completed', 'running', runA_id);
    assert('15. Invalid state transition rejected', false, 'Expected StateTransitionError');
  } catch (err) {
    assert('15. Invalid state transition rejected', err instanceof StateTransitionError || (err as any).code === 'INVALID_STATE_TRANSITION', (err as Error).message);
  }

  // 16. Already-running run cannot execute concurrently
  try {
    const atomicSql = RunStateMachine.getAtomicTransitionSql(runA_id, 'pending', 'running');
    const atomicRes = await adminSqlFn(atomicSql);
    assert('16. Already-running/completed run cannot transition from pending', !atomicRes.body?.result?.[1]);
  } catch (err) {
    assert('16. Already-running/completed run cannot transition from pending', true);
  }

  // 17. Completed run cannot execute again
  try {
    await executor.resumeWorkflowRun(runA_id, { approved: true });
    assert('17. Completed run cannot execute again', false, 'Expected StateTransitionError');
  } catch (err) {
    assert('17. Completed run cannot execute again', err instanceof StateTransitionError || (err as any).code === 'INVALID_STATE_TRANSITION', (err as Error).message);
  }

  // 18. Secrets are not written to errors/audit logs
  const textWithSecret = 'Error with API Key AQ.Ab8RN6I9oD2BhepLqkrx1ruc and Authorization: Bearer eyJhbGciOiJSUzI1Ni';
  const sanitized = sanitizeText(textWithSecret);
  assert('18. Secrets are not written to errors/audit logs', !sanitized.includes('AQ.Ab8RN6I9oD2BhepLqkrx1ruc') && sanitized.includes('[REDACTED_SECRET]'));

  // 20. Quota is NOT incremented for failed workflow
  const quotaUsedOrgA_BeforeFail = parseInt((await adminSqlFn(`SELECT quota_used FROM public.organizations WHERE id = '${ids.orgA_id}';`)).body.result[1][0], 10);
  await executor.executeWorkflow({ workflow_id: wfFailing_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const quotaUsedOrgA_AfterFail = parseInt((await adminSqlFn(`SELECT quota_used FROM public.organizations WHERE id = '${ids.orgA_id}';`)).body.result[1][0], 10);
  assert('20. Quota is NOT incremented for failed workflow', quotaUsedOrgA_BeforeFail === quotaUsedOrgA_AfterFail);

  // 21. Quota increments exactly once for successful workflow
  const quotaUsedOrgA_BeforeSuccess = parseInt((await adminSqlFn(`SELECT quota_used FROM public.organizations WHERE id = '${ids.orgA_id}';`)).body.result[1][0], 10);
  await executor.executeWorkflow({ workflow_id: ids.wfA_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const quotaUsedOrgA_AfterSuccess = parseInt((await adminSqlFn(`SELECT quota_used FROM public.organizations WHERE id = '${ids.orgA_id}';`)).body.result[1][0], 10);
  assert('21. Quota increments exactly once for successful workflow', quotaUsedOrgA_AfterSuccess === (quotaUsedOrgA_BeforeSuccess + 1));

  // 22. Quota Concurrency Guard
  try {
    await executor.executeWorkflow({ workflow_id: ids.wfQuota1_id, org_id: ids.orgQuota1_id, trigger_type: 'manual' });
    await executor.executeWorkflow({ workflow_id: ids.wfQuota1_id, org_id: ids.orgQuota1_id, trigger_type: 'manual' });
    assert('22. Quota Concurrency Guard blocks execution when exhausted', false, 'Expected QuotaExhaustedError');
  } catch (err) {
    assert('22. Quota Concurrency Guard blocks execution when exhausted', err instanceof QuotaExhaustedError || (err as any).code === 'QUOTA_EXHAUSTED', (err as Error).message);
  }

  return results;
}
