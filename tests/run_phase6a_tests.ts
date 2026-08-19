/**
 * AI Agent Workflow Builder — Phase 6A Verification Master Runner
 * Executes Suite A (Integration & Security Tests) and Suite B (Frontend & Unit State Tests).
 */

import { runIntegrationAndSecurityTests } from './phase6a_integration.test';
import { runFrontendUnitTests } from './phase6a_frontend.test';

const HASURA_QUERY_URL =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL?.replace('/v1/graphql', '/v1/query') ||
  'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/query';

const NHOST_AUTH_URL = 'https://rwbwrptitwkxuqgmbbpi.auth.ap-south-1.nhost.run/v1';

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

async function createNhostUserAndSignIn(email: string, pass: string) {
  // 1. Insert user into auth.users directly with pgcrypto crypt()
  const insertRes = await runAdminSql(`
    INSERT INTO auth.users (email, email_verified, password_hash, default_role, disabled, locale)
    VALUES ('${email}', true, crypt('${pass}', gen_salt('bf')), 'user', false, 'en')
    RETURNING id;
  `);

  if (!insertRes.body?.result?.[1]?.[0]) {
    throw new Error(`Failed to insert user ${email}: ${JSON.stringify(insertRes.body)}`);
  }

  // 2. Sign in via Nhost Auth API to obtain genuine Nhost user session & JWT
  const res = await fetch(`${NHOST_AUTH_URL}/signin/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });

  const json = await res.json();
  if (!json.session?.accessToken) {
    throw new Error(`Failed to sign in Nhost user ${email}: ${JSON.stringify(json)}`);
  }

  return json.session;
}

async function main() {
  console.log('==================================================');
  console.log('PHASE 6A — FRONTEND FOUNDATION & ORG CONTEXT TEST RUNNER');
  console.log('==================================================\n');

  console.log('--- Setting up Phase 6A Test Fixtures ---');

  const timestamp = Date.now();
  const emailA = `p6a_userA_${timestamp}@test.com`;
  const emailB = `p6a_userB_${timestamp}@test.com`;
  const pass = 'TestPass123!Secure';

  // 1. Obtain Genuine Nhost User Sessions & JWTs
  const sessionA = await createNhostUserAndSignIn(emailA, pass);
  const sessionB = await createNhostUserAndSignIn(emailB, pass);

  const userA_id = sessionA.user.id;
  const userB_id = sessionB.user.id;

  // 2. Create Organizations in public.organizations
  const orgARes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 6A Org A', 100, 0) RETURNING id;`);
  const orgA_id = orgARes.body.result[1][0];

  const orgBRes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 6A Org B', 100, 0) RETURNING id;`);
  const orgB_id = orgBRes.body.result[1][0];

  // 3. Create org_members records
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${userA_id}', 'owner');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgB_id}', '${userB_id}', 'viewer');`);

  // 4. Create Workflows
  const wfARes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, description, is_active) VALUES ('${orgA_id}', 'Phase 6A Org A Workflow', 'Org A test workflow', true) RETURNING id;`);
  const wfA_id = wfARes.body.result[1][0];

  const wfBRes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, description, is_active) VALUES ('${orgB_id}', 'Phase 6A Org B Workflow', 'Org B test workflow', false) RETURNING id;`);
  const wfB_id = wfBRes.body.result[1][0];

  console.log(`Fixtures ready. User A: ${userA_id}, User B: ${userB_id}`);

  // 5. Run Suite A: Integration & Security Verification
  console.log('\n--- Running Suite A: Integration & Security Tests ---');
  const suiteA_results = await runIntegrationAndSecurityTests(
    { userA: sessionA.accessToken, userB: sessionB.accessToken },
    { userA_id, userB_id },
    { orgA_id, orgB_id },
    { wfA_id, wfB_id }
  );

  // 6. Run Suite B: Frontend & Unit Verification
  console.log('\n--- Running Suite B: Frontend & Unit Tests ---');
  const suiteB_results = runFrontendUnitTests();

  // 7. Aggregate and Display Results
  const allResults = [...suiteA_results, ...suiteB_results];
  let passedCount = 0;

  console.log('\n==================================================');
  console.log('PHASE 6A VERIFICATION RESULTS');
  console.log('==================================================');

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
  console.error('Fatal error running Phase 6A verification:', err);
  process.exit(1);
});
