/**
 * AI Agent Workflow Builder — Master Test Suite Runner (Phase 4A + 4B + 5)
 */

import { WorkflowExecutor } from '../server/workflow/executor';
import { TriggerProcessor } from '../server/workflow/triggers';
import { runPhase4ATests } from './phase4a_executor.test';
import { runPhase4BTests } from './phase4b_triggers.test';
import { runPhase5Tests } from './phase5_actions.test';
import { runPhase7Tests } from './phase7_ai_assistant.test';

const HASURA_QUERY_URL =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL?.replace('/v1/graphql', '/v1/query') ||
  'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/query';

const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '933711c11c9b22f1537204d5bd536a5a957cb37cb24d320c6f755a5a07ed485c';

async function runAdminSql(sql: string) {
  const res = await fetch(HASURA_QUERY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'run_sql',
      args: { sql },
    }),
  });
  const json = await res.json();
  return { body: json };
}

async function main() {
  process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
  console.log('==================================================');
  console.log('AI AGENT WORKFLOW BUILDER — MASTER VERIFICATION');
  console.log('==================================================\n');

  const executor = new WorkflowExecutor(runAdminSql);
  const processor = new TriggerProcessor(executor, runAdminSql);

  // 1. Setup Phase 4A Fixtures
  const orgA_4a = (await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('P4A Org A', 100, 0) RETURNING id;`)).body.result[1][0];
  const orgQuota1_4a = (await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('P4A Org Quota', 1, 0) RETURNING id;`)).body.result[1][0];

  const wfA_4a = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_4a}', 'P4A Wf A', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfA_4a}', 1, 'http_request', '{"url":"https://jsonplaceholder.typicode.com/posts/1"}');`);

  const wfInactive_4a = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_4a}', 'P4A Inactive', false) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfInactive_4a}', 1, 'http_request', '{"url":"https://jsonplaceholder.typicode.com/posts/1"}');`);

  const wfCond_4a = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_4a}', 'P4A Cond', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfCond_4a}', 1, 'conditional_branch', '{"field":"approved","operator":"equals","value":true}');`);
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfCond_4a}', 2, 'http_request', '{"url":"https://jsonplaceholder.typicode.com/posts/1"}');`);

  const wfApproval_4a = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_4a}', 'P4A Approval', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_4a}', 1, 'approval_gate', '{"message":"Approve"}');`);
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_4a}', 2, 'http_request', '{"url":"https://jsonplaceholder.typicode.com/posts/1"}');`);

  const wfQuota1_4a = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgQuota1_4a}', 'P4A Quota1', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfQuota1_4a}', 1, 'http_request', '{"url":"https://jsonplaceholder.typicode.com/posts/1"}');`);

  console.log('--- Running Phase 4A Tests ---');
  const res4A = await runPhase4ATests(executor, runAdminSql, {
    orgA_id: orgA_4a,
    orgQuota1_id: orgQuota1_4a,
    wfA_id: wfA_4a,
    wfInactive_id: wfInactive_4a,
    wfCond_id: wfCond_4a,
    wfApproval_id: wfApproval_4a,
    wfQuota1_id: wfQuota1_4a,
  });
  const passed4A = res4A.filter(r => r.passed).length;
  console.log(`Phase 4A Results: ${passed4A}/${res4A.length} passed.`);

  // 2. Setup Phase 4B Fixtures
  const trigActive_4b = (await runAdminSql(`INSERT INTO public.workflow_triggers (workflow_id, trigger_type, is_enabled) VALUES ('${wfA_4a}', 'webhook', true) RETURNING id;`)).body.result[1][0];
  const trigDisabled_4b = (await runAdminSql(`INSERT INTO public.workflow_triggers (workflow_id, trigger_type, is_enabled) VALUES ('${wfA_4a}', 'webhook', false) RETURNING id;`)).body.result[1][0];
  const trigInactiveWf_4b = (await runAdminSql(`INSERT INTO public.workflow_triggers (workflow_id, trigger_type, is_enabled) VALUES ('${wfInactive_4a}', 'webhook', true) RETURNING id;`)).body.result[1][0];
  const notif_4b = (await runAdminSql(`INSERT INTO public.notifications (org_id, recipient, channel, payload, delivery_status) VALUES ('${orgA_4a}', 'user@test.com', 'email', '{"body":"test"}', 'pending') RETURNING id;`)).body.result[1][0];

  console.log('--- Running Phase 4B Tests ---');
  const res4B = await runPhase4BTests(processor, runAdminSql, WEBHOOK_SECRET, {
    trigActive_id: trigActive_4b,
    trigDisabled_id: trigDisabled_4b,
    trigInactiveWf_id: trigInactiveWf_4b,
    notif_id: notif_4b,
  });
  const passed4B = res4B.filter(r => r.passed).length;
  console.log(`Phase 4B Results: ${passed4B}/${res4B.length} passed.`);

  // 3. Run Phase 5 Tests
  console.log('--- Running Phase 5 Tests ---');
  const timestamp = Date.now();
  const orgA_5 = (await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('P5 Org A', 100, 0) RETURNING id;`)).body.result[1][0];
  const orgB_5 = (await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('P5 Org B', 100, 0) RETURNING id;`)).body.result[1][0];
  const orgQuota_5 = (await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('P5 Org Quota', 1, 0) RETURNING id;`)).body.result[1][0];

  const ownerA_5 = (await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('ownerA_${timestamp}@test.com', 'Owner A', 'hash', now(), 'en') RETURNING id;`)).body.result[1][0];
  const editorA_5 = (await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('editorA_${timestamp}@test.com', 'Editor A', 'hash', now(), 'en') RETURNING id;`)).body.result[1][0];
  const viewerA_5 = (await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('viewerA_${timestamp}@test.com', 'Viewer A', 'hash', now(), 'en') RETURNING id;`)).body.result[1][0];
  const ownerB_5 = (await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('ownerB_${timestamp}@test.com', 'Owner B', 'hash', now(), 'en') RETURNING id;`)).body.result[1][0];
  const viewerB_5 = (await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('viewerB_${timestamp}@test.com', 'Viewer B', 'hash', now(), 'en') RETURNING id;`)).body.result[1][0];

  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_5}', '${ownerA_5}', 'owner');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_5}', '${editorA_5}', 'editor');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_5}', '${viewerA_5}', 'viewer');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgB_5}', '${ownerB_5}', 'owner');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgB_5}', '${viewerB_5}', 'viewer');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgQuota_5}', '${ownerA_5}', 'owner');`);

  const wfA_5 = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_5}', 'P5 Org A Active Wf', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfA_5}', 1, 'llm_call', '{"simulateNotImplemented":false}');`);

  const wfInactive_5 = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_5}', 'P5 Org A Inactive Wf', false) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfInactive_5}', 1, 'llm_call', '{"simulateNotImplemented":false}');`);

  const wfQuota_5 = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgQuota_5}', 'P5 Quota Wf', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfQuota_5}', 1, 'llm_call', '{"simulateNotImplemented":false}');`);

  const wfApproval_5 = (await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_5}', 'P5 Approval Wf', true) RETURNING id;`)).body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_5}', 1, 'approval_gate', '{"message":"Please approve"}');`);
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_5}', 2, 'llm_call', '{"simulateNotImplemented":false}');`);

  const res5 = await runPhase5Tests(executor, runAdminSql, {
    orgA_id: orgA_5,
    orgB_id: orgB_5,
    orgQuota_id: orgQuota_5,
    ownerA_id: ownerA_5,
    editorA_id: editorA_5,
    viewerA_id: viewerA_5,
    ownerB_id: ownerB_5,
    viewerB_id: viewerB_5,
    wfA_id: wfA_5,
    wfInactive_id: wfInactive_5,
    wfQuota_id: wfQuota_5,
    wfApproval_id: wfApproval_5,
    wfApproval2_id: wfApproval_5,
  });
  const passed5 = res5.filter(r => r.passed).length;
  console.log(`Phase 5 Results: ${passed5}/${res5.length} passed.`);

  // 4. Run Phase P7 AI Assistant Tests
  console.log('--- Running Phase P7 AI Assistant Tests ---');
  const res7 = await runPhase7Tests();
  const passed7 = res7.passed;
  const total7 = res7.total;

  console.log('\n==================================================');
  console.log(`ALL TEST SUITES TOTAL: ${passed4A + passed4B + passed5 + passed7}/${res4A.length + res4B.length + res5.length + total7} passed.`);
  console.log('==================================================');

  if (passed4A < res4A.length || passed4B < res4B.length || passed5 < res5.length || passed7 < total7) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in master test suite runner:', err);
  process.exit(1);
});
