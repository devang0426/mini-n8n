/**
 * AI Agent Workflow Builder — Final Integration Test Suite Runner (Phase 7)
 */

import { WorkflowExecutor } from '../server/workflow/executor';
import { TriggerProcessor } from '../server/workflow/triggers';
import { ActionProcessor } from '../server/workflow/actions';
import { runFinalIntegrationTests } from './final_integration.test';

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
  console.log('==================================================');
  console.log('PHASE 7 — FINAL INTEGRATION & SCENARIO VERIFICATION');
  console.log('==================================================\n');

  const executor = new WorkflowExecutor(runAdminSql);
  const processor = new TriggerProcessor(executor, runAdminSql);
  const actionProcessor = new ActionProcessor(executor, runAdminSql);

  const results = await runFinalIntegrationTests(executor, processor, actionProcessor, runAdminSql, WEBHOOK_SECRET);

  console.log('\n==================================================');
  console.log('DETAILED VERIFICATION RESULTS');
  console.log('==================================================\n');

  let passedCount = 0;
  for (const r of results) {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    if (r.passed) passedCount++;
    console.log(`Assertion #${r.assertion} [${r.category}] ${r.name}: ${mark}${r.message ? ` (${r.message})` : ''}`);
  }

  console.log('\n==================================================');
  console.log(`FINAL ACCPETANCE SCORE: ${passedCount}/${results.length} PASSED`);
  console.log('==================================================');

  if (passedCount < results.length) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running final integration suite:', err);
  process.exit(1);
});
