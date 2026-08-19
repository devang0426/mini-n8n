/**
 * AI Agent Workflow Builder — Phase 6C Verification Master Runner
 * Executes Suite A (GraphQL Integration & Security) and Suite B (Frontend & UX State) tests.
 */

import { runSuiteA_IntegrationTests, runSuiteB_FrontendUnitTests, TestResult } from './phase6c_execution_ui.test';
import * as fs from 'fs';
import * as path from 'path';

const HASURA_QUERY_URL =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL?.replace('/v1/graphql', '/v1/query') ||
  'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/query';

const NHOST_AUTH_URL = 'https://rwbwrptitwkxuqgmbbpi.auth.ap-south-1.nhost.run/v1';

const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';

const CACHE_FILE = path.join(__dirname, '.token_cache.json');

function loadCachedSession(email: string): any | null {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (data[email] && data[email].accessToken) {
      return data[email];
    }
  } catch {
    return null;
  }
  return null;
}

function saveCachedSession(email: string, session: any) {
  let cache: Record<string, any> = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      cache = {};
    }
  }
  cache[email] = session;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

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

async function getOrCreateNhostUserSession(email: string, pass: string) {
  const cached = loadCachedSession(email);
  if (cached) {
    return cached;
  }

  // 1. Check if user exists in auth.users
  const checkRes = await runAdminSql(`SELECT id FROM auth.users WHERE email = '${email}' LIMIT 1;`);
  let userId = checkRes.body?.result?.[1]?.[0];

  if (!userId) {
    // Insert user into auth.users directly with pgcrypto crypt()
    const insertRes = await runAdminSql(`
      INSERT INTO auth.users (email, email_verified, password_hash, default_role, disabled, locale)
      VALUES ('${email}', true, crypt('${pass}', gen_salt('bf')), 'user', false, 'en')
      RETURNING id;
    `);
    userId = insertRes.body?.result?.[1]?.[0];
    if (!userId) {
      throw new Error(`Failed to insert user ${email}: ${JSON.stringify(insertRes.body)}`);
    }
  }

  // 2. Sign in via Nhost Auth API with backoff
  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const res = await fetch(`${NHOST_AUTH_URL}/signin/email-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    if (res.status === 429) {
      console.log(`Nhost Auth 429 rate limit encountered for ${email}. Waiting ${(attempts * 2000)}ms...`);
      await new Promise((r) => setTimeout(r, attempts * 2000));
      continue;
    }

    const text = await res.text();
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse Nhost signin response (status ${res.status}): '${text}'`);
    }

    if (!json.session?.accessToken) {
      throw new Error(`Failed to sign in Nhost user ${email} (status ${res.status}): ${text}`);
    }

    saveCachedSession(email, json.session);
    return json.session;
  }

  throw new Error(`Failed to sign in Nhost user ${email} after ${attempts} attempts due to rate limits.`);
}

function runSecretAudit(): TestResult {
  try {
    const clientDirs = ['app', 'components', 'hooks', 'lib'];
    const secretsToSearch = [
      process.env.HASURA_GRAPHQL_ADMIN_SECRET,
      process.env.LLM_API_KEY,
      process.env.WEBHOOK_SECRET,
    ].filter(Boolean) as string[];

    let leakedFound = false;
    let leakDetails = '';

    const rootDir = path.resolve(__dirname, '..');

    function searchDirectory(dirPath: string) {
      if (!fs.existsSync(dirPath)) return;
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchDirectory(fullPath);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const secret of secretsToSearch) {
            if (content.includes(secret)) {
              leakedFound = true;
              leakDetails += `Secret value leaked in ${fullPath}; `;
            }
          }
          if (content.includes('HASURA_GRAPHQL_ADMIN_SECRET') && !fullPath.includes('api')) {
            leakedFound = true;
            leakDetails += `HASURA_GRAPHQL_ADMIN_SECRET string in client code ${fullPath}; `;
          }
        }
      }
    }

    for (const dir of clientDirs) {
      searchDirectory(path.join(rootDir, dir));
    }

    return {
      name: 'Audit: Zero server secrets in client source code',
      passed: !leakedFound,
      message: leakedFound ? leakDetails : undefined,
    };
  } catch (err) {
    return {
      name: 'Audit: Zero server secrets in client source code',
      passed: false,
      message: (err as Error).message,
    };
  }
}

async function main() {
  console.log('==================================================');
  console.log('PHASE 6C — WORKFLOW EXECUTION UI TEST RUNNER');
  console.log('==================================================\n');

  console.log('--- Setting up Phase 6C Test Fixtures ---');

  const pass = 'TestPass123!Secure';

  const ownerA_email = `p6b_ownerA_fixed@test.com`;
  const editorA_email = `p6b_editorA_fixed@test.com`;
  const viewerA_email = `p6b_viewerA_fixed@test.com`;
  const ownerB_email = `p6b_ownerB_fixed@test.com`;

  // 1. Obtain Nhost User Sessions
  const sessionOwnerA = await getOrCreateNhostUserSession(ownerA_email, pass);
  const sessionEditorA = await getOrCreateNhostUserSession(editorA_email, pass);
  const sessionViewerA = await getOrCreateNhostUserSession(viewerA_email, pass);
  const sessionOwnerB = await getOrCreateNhostUserSession(ownerB_email, pass);

  // 2. Create Organizations
  const orgARes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 6C Org A', 100, 0) RETURNING id;`);
  const orgA_id = orgARes.body.result[1][0];

  const orgBRes = await runAdminSql(`INSERT INTO public.organizations (name, quota_limit, quota_used) VALUES ('Phase 6C Org B', 100, 0) RETURNING id;`);
  const orgB_id = orgBRes.body.result[1][0];

  // 3. Insert org_members
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${sessionOwnerA.user.id}', 'owner');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${sessionEditorA.user.id}', 'editor');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgA_id}', '${sessionViewerA.user.id}', 'viewer');`);
  await runAdminSql(`INSERT INTO public.org_members (org_id, user_id, role) VALUES ('${orgB_id}', '${sessionOwnerB.user.id}', 'owner');`);

  console.log(`Fixtures ready. Org A: ${orgA_id}, Org B: ${orgB_id}`);

  // 4. Secret Audit
  const secretAuditResult = runSecretAudit();

  // 5. Run Suite A: Integration Tests
  console.log('\n--- Running Suite A: Integration & Security Tests ---');
  const suiteA_results = await runSuiteA_IntegrationTests(
    {
      ownerA: sessionOwnerA.accessToken,
      editorA: sessionEditorA.accessToken,
      viewerA: sessionViewerA.accessToken,
      ownerB: sessionOwnerB.accessToken,
    },
    { orgA_id, orgB_id }
  );

  // 6. Run Suite B: Frontend & Unit Tests
  console.log('\n--- Running Suite B: Frontend & Unit Tests ---');
  const suiteB_results = runSuiteB_FrontendUnitTests();

  // 7. Display Results
  const allResults = [secretAuditResult, ...suiteA_results, ...suiteB_results];
  let passedCount = 0;

  console.log('\n==================================================');
  console.log('PHASE 6C VERIFICATION RESULTS');
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
  console.error('Fatal error running Phase 6C verification:', err);
  process.exit(1);
});
