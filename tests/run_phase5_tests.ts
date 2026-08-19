/**
 * AI Agent Workflow Builder — Phase 5 Test Runner
 * Executes both Phase 5 Actions test suite AND Phase 5 Security Audit test suite.
 */

import { WorkflowExecutor } from '../server/workflow/executor';
import { runPhase5Tests } from './phase5_actions.test';
import { runSecurityAuditTests } from './phase5_security_audit.test';

const HASURA_QUERY_URL =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL?.replace('/v1/graphql', '/v1/query') ||
  'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/query';

const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';

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
  if (json.error) {
    console.error('SQL Execution Error:', json.error, 'in SQL:', sql);
  }
  return { body: json };
}

async function main() {
  console.log('--- Setting up Phase 5 Test Fixtures ---');

  // 1. Create Test Organizations
  const orgARes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 5 Org A', 100, 0) RETURNING id;`);
  const orgA_id = orgARes.body.result[1][0];

  const orgBRes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 5 Org B', 100, 0) RETURNING id;`);
  const orgB_id = orgBRes.body.result[1][0];

  const orgQuotaRes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 5 Org Quota Limit', 1, 0) RETURNING id;`);
  const orgQuota_id = orgQuotaRes.body.result[1][0];

  // 2. Create Test Users in auth.users
  const timestamp = Date.now();
  const ownerARes = await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('ownerA_${timestamp}@test.com', 'Owner A', 'hash', now(), 'en') RETURNING id;`);
  const ownerA_id = ownerARes.body.result[1][0];

  const editorARes = await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('editorA_${timestamp}@test.com', 'Editor A', 'hash', now(), 'en') RETURNING id;`);
  const editorA_id = editorARes.body.result[1][0];

  const viewerARes = await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('viewerA_${timestamp}@test.com', 'Viewer A', 'hash', now(), 'en') RETURNING id;`);
  const viewerA_id = viewerARes.body.result[1][0];

  const ownerBRes = await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('ownerB_${timestamp}@test.com', 'Owner B', 'hash', now(), 'en') RETURNING id;`);
  const ownerB_id = ownerBRes.body.result[1][0];

  const viewerBRes = await runAdminSql(`INSERT INTO auth.users (email, display_name, password_hash, ticket_expires_at, locale) VALUES ('viewerB_${timestamp}@test.com', 'Viewer B', 'hash', now(), 'en') RETURNING id;`);
  const viewerB_id = viewerBRes.body.result[1][0];

  // 3. Create org_members records
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${ownerA_id}', 'owner');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${editorA_id}', 'editor');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${viewerA_id}', 'viewer');`);

  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgB_id}', '${ownerB_id}', 'owner');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgB_id}', '${viewerB_id}', 'viewer');`);

  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgQuota_id}', '${ownerA_id}', 'owner');`);

  // 4. Create Workflows and Steps (using in-memory stub steps)
  // wfA (Org A - Active)
  const wfARes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_id}', 'Phase 5 Org A Active Wf', true) RETURNING id;`);
  const wfA_id = wfARes.body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfA_id}', 1, 'llm_call', '{"simulateNotImplemented":false}');`);

  // wfInactive (Org A - Inactive)
  const wfInactiveRes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_id}', 'Phase 5 Org A Inactive Wf', false) RETURNING id;`);
  const wfInactive_id = wfInactiveRes.body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfInactive_id}', 1, 'llm_call', '{"simulateNotImplemented":false}');`);

  // wfQuota (Org Quota Limit - Limit 1)
  const wfQuotaRes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgQuota_id}', 'Phase 5 Quota Wf', true) RETURNING id;`);
  const wfQuota_id = wfQuotaRes.body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfQuota_id}', 1, 'llm_call', '{"simulateNotImplemented":false}');`);

  // wfApproval (Org A - Approval Gate)
  const wfAppRes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_id}', 'Phase 5 Approval Wf', true) RETURNING id;`);
  const wfApproval_id = wfAppRes.body.result[1][0];
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_id}', 1, 'approval_gate', '{"message":"Please approve this step"}');`);
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_id}', 2, 'llm_call', '{"simulateNotImplemented":false}');`);

  const executor = new WorkflowExecutor(runAdminSql);

  console.log('--- Running Phase 5 Functional Test Suite ---');
  const results = await runPhase5Tests(executor, runAdminSql, {
    orgA_id,
    orgB_id,
    orgQuota_id,
    ownerA_id,
    editorA_id,
    viewerA_id,
    ownerB_id,
    viewerB_id,
    wfA_id,
    wfInactive_id,
    wfQuota_id,
    wfApproval_id,
    wfApproval2_id: wfApproval_id,
  });

  console.log('\n--- Running Phase 5 Security Audit Test Suite ---');
  const secResults = await runSecurityAuditTests(runAdminSql, {
    orgA_id,
    orgB_id,
    ownerA_id,
    editorA_id,
    viewerA_id,
    ownerB_id,
    wfA_id,
    wfApproval_id,
  });

  console.log('\n--- Phase 5 Verification & Security Audit Results ---');
  let passedCount = 0;
  const allResults = [...results, ...secResults];
  for (const r of allResults) {
    if (r.passed) {
      passedCount++;
      console.log(`✅ ${r.name}`);
    } else {
      console.error(`❌ ${r.name}: ${r.message}`);
    }
  }

  console.log(`\nSummary: ${passedCount}/${allResults.length} assertions passed.\n`);

  if (passedCount < allResults.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running Phase 5 test suite:', err);
  process.exit(1);
});
