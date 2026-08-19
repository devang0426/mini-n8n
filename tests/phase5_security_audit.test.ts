/**
 * AI Agent Workflow Builder — Phase 5 Security Audit Test Suite
 * Focuses exclusively on authenticated identity handling and spoofing prevention in Hasura Action endpoints.
 */

import { POST as triggerWorkflowRoute } from '../app/api/actions/trigger-workflow/route';
import { POST as approveStepRoute } from '../app/api/actions/approve-step/route';
import { WorkflowExecutor } from '../server/workflow/executor';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runSecurityAuditTests(
  adminSqlFn: (sql: string) => Promise<any>,
  ids: {
    orgA_id: string;
    orgB_id: string;
    ownerA_id: string;
    editorA_id: string;
    viewerA_id: string;
    ownerB_id: string;
    wfA_id: string;
    wfApproval_id: string;
  }
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function assert(name: string, passed: boolean, message = '') {
    results.push({ name, passed, message });
  }

  const executor = new WorkflowExecutor(adminSqlFn);

  // Setup a paused approval gate workflow run in Org A for approval testing
  const pausedRun = await executor.executeWorkflow({ workflow_id: ids.wfApproval_id, org_id: ids.orgA_id, trigger_type: 'manual' });
  const pausedRun_id = pausedRun.workflow_run_id;
  const srun_db = (
    await adminSqlFn(`SELECT id FROM public.step_runs WHERE workflow_run_id = '${pausedRun_id}' AND status = 'paused';`)
  ).body.result[1];
  const stepRun_id = srun_db[0];

  // Helper to create synthetic NextRequest for API route testing
  function createActionRequest(url: string, bodyObj: any, headersObj: Record<string, string> = {}) {
    return new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headersObj,
      },
      body: JSON.stringify(bodyObj),
    });
  }

  // ============================================================================
  // Security Audit Assertions 1 - 7
  // ============================================================================

  // 1. Valid authenticated Hasura request identifies the correct user
  try {
    const req = createActionRequest('http://localhost:3000/api/actions/trigger-workflow', {
      input: { workflow_id: ids.wfA_id },
      session_variables: { 'x-hasura-user-id': ids.ownerA_id, 'x-hasura-role': 'user' }
    });
    const res = await triggerWorkflowRoute(req);
    const json = await res.json();
    assert(
      '1. Valid authenticated Hasura request identifies the correct user',
      res.status === 200 && json.success === true && !!json.workflow_run_id,
      json.error || ''
    );
  } catch (err: any) {
    assert('1. Valid authenticated Hasura request identifies the correct user', false, err.message);
  }

  // 2. Spoofed X-Hasura-User-Id header cannot impersonate another user
  try {
    // Client sends X-Hasura-User-Id: ownerA_id in headers, BUT Hasura validated session_variables has ownerB_id
    const req = createActionRequest(
      'http://localhost:3000/api/actions/trigger-workflow',
      {
        input: { workflow_id: ids.wfA_id },
        session_variables: { 'x-hasura-user-id': ids.ownerB_id, 'x-hasura-role': 'user' }
      },
      { 'X-Hasura-User-Id': ids.ownerA_id } // Spoofed client header!
    );
    const res = await triggerWorkflowRoute(req);
    const json = await res.json();
    assert(
      '2. Spoofed X-Hasura-User-Id header cannot impersonate another user',
      res.status === 403 && json.code === 'CROSS_ORG_ACCESS_DENIED',
      `Expected status 403 and CROSS_ORG_ACCESS_DENIED, got ${res.status} (${json.code})`
    );
  } catch (err: any) {
    assert('2. Spoofed X-Hasura-User-Id header cannot impersonate another user', false, err.message);
  }

  // 3. User cannot trigger another user's organization workflow by changing headers or input
  try {
    // Malicious caller sends client header AND body overrides trying to impersonate ownerA
    const req = createActionRequest(
      'http://localhost:3000/api/actions/trigger-workflow',
      {
        input: { workflow_id: ids.wfA_id, user_id: ids.ownerA_id },
        callerUserId: ids.ownerA_id,
        user_id: ids.ownerA_id,
        session_variables: { 'x-hasura-user-id': ids.ownerB_id, 'x-hasura-role': 'user' }
      },
      { 'x-hasura-user-id': ids.ownerA_id, 'authorization': 'Bearer spoofed_token' }
    );
    const res = await triggerWorkflowRoute(req);
    const json = await res.json();
    assert(
      "3. User cannot trigger another user's organization workflow by changing headers or input",
      res.status === 403 && json.code === 'CROSS_ORG_ACCESS_DENIED',
      `Expected status 403, got ${res.status}`
    );
  } catch (err: any) {
    assert("3. User cannot trigger another user's organization workflow by changing headers or input", false, err.message);
  }

  // 4. User cannot approve another organization's approval gate by changing headers or input
  try {
    const req = createActionRequest(
      'http://localhost:3000/api/actions/approve-step',
      {
        input: { workflow_run_id: pausedRun_id, step_run_id: stepRun_id, approved: true, user_id: ids.ownerA_id },
        callerUserId: ids.ownerA_id,
        session_variables: { 'x-hasura-user-id': ids.ownerB_id, 'x-hasura-role': 'user' }
      },
      { 'x-hasura-user-id': ids.ownerA_id } // Spoofed header
    );
    const res = await approveStepRoute(req);
    const json = await res.json();
    assert(
      "4. User cannot approve another organization's approval gate by changing headers or input",
      res.status === 403 && json.code === 'CROSS_ORG_ACCESS_DENIED',
      `Expected status 403, got ${res.status}`
    );
  } catch (err: any) {
    assert("4. User cannot approve another organization's approval gate by changing headers or input", false, err.message);
  }

  // 5. Removing trusted session identity results in authentication failure
  try {
    // Request sent with HTTP header ONLY (no trusted Hasura session_variables)
    const req = createActionRequest(
      'http://localhost:3000/api/actions/trigger-workflow',
      { input: { workflow_id: ids.wfA_id } },
      { 'x-hasura-user-id': ids.ownerA_id }
    );
    const res = await triggerWorkflowRoute(req);
    const json = await res.json();
    assert(
      '5. Removing trusted session identity results in authentication failure',
      res.status === 401 && json.code === 'UNAUTHENTICATED',
      `Expected status 401, got ${res.status}`
    );
  } catch (err: any) {
    assert('5. Removing trusted session identity results in authentication failure', false, err.message);
  }

  // 6. Action authorization continues to use: authenticated user ID + org_members + target resource org_id
  try {
    // Authorized ownerA request with trusted session_variables
    const reqOwnerA = createActionRequest('http://localhost:3000/api/actions/approve-step', {
      input: { workflow_run_id: pausedRun_id, step_run_id: stepRun_id, approved: true },
      session_variables: { 'x-hasura-user-id': ids.ownerA_id, 'x-hasura-role': 'user' }
    });
    const resOwnerA = await approveStepRoute(reqOwnerA);
    const jsonOwnerA = await resOwnerA.json();

    // Verify DB records approved_by equals ownerA_id derived from org_members lookup
    const dbCheck = (await adminSqlFn(`SELECT approved_by FROM public.step_runs WHERE id = '${stepRun_id}';`)).body.result[1];

    assert(
      '6. Action authorization uses authenticated user ID + org_members + target resource org_id',
      resOwnerA.status === 200 && jsonOwnerA.success === true && dbCheck[0] === ids.ownerA_id,
      `Expected approved_by = ${ids.ownerA_id}, got ${dbCheck[0]}`
    );
  } catch (err: any) {
    assert('6. Action authorization uses authenticated user ID + org_members + target resource org_id', false, err.message);
  }

  // 7. No admin secret is exposed
  try {
    const req = createActionRequest('http://localhost:3000/api/actions/trigger-workflow', {
      input: { workflow_id: ids.wfA_id },
      session_variables: { 'x-hasura-user-id': ids.ownerA_id, 'x-hasura-role': 'user' }
    });
    const res = await triggerWorkflowRoute(req);
    const jsonStr = JSON.stringify(await res.json());

    const clientCode = fs.readFileSync(path.join(process.cwd(), 'lib/graphql/client.ts'), 'utf8');

    const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET || ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';

    assert(
      '7. No admin secret is exposed in Action responses or client code',
      !jsonStr.includes(adminSecret) && !clientCode.includes('HASURA_GRAPHQL_ADMIN_SECRET')
    );
  } catch (err: any) {
    assert('7. No admin secret is exposed in Action responses or client code', false, err.message);
  }

  return results;
}
