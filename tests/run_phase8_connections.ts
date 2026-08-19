/**
 * AI Agent Workflow Builder — Phase 8 Connections Runner (Phase P3)
 */

import { WorkflowExecutor } from '../server/workflow/executor';
import { runConnectionsTests } from './phase8_connections.test';

process.env.CONNECTION_ENCRYPTION_KEY =
  process.env.CONNECTION_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
  return { body: json };
}

async function main() {
  console.log('==================================================');
  console.log('PHASE P3 — SECURE CONNECTIONS & CREDENTIAL SUITE');
  console.log('==================================================\n');

  // Ensure connections table exists
  const migrationSql = `
    CREATE TABLE IF NOT EXISTS public.connections (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        name                    TEXT NOT NULL,
        provider                TEXT NOT NULL,
        type                    TEXT NOT NULL,
        encrypted_credentials   TEXT NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'Not tested',
        metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await runAdminSql(migrationSql);

  const executor = new WorkflowExecutor(runAdminSql);
  const results = await runConnectionsTests(executor, runAdminSql);

  console.log('==================================================');
  console.log('DETAILED CONNECTIONS VERIFICATION RESULTS');
  console.log('==================================================\n');

  let passedCount = 0;
  for (const r of results) {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    if (r.passed) passedCount++;
    console.log(`Assertion #${r.assertion} [${r.category}] ${r.name}: ${mark}${r.message ? ` (${r.message})` : ''}`);
  }

  console.log('\n==================================================');
  console.log(`CONNECTIONS ACCEPTANCE SCORE: ${passedCount}/${results.length} PASSED`);
  console.log('==================================================');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running connections test suite:', err);
  process.exit(1);
});
