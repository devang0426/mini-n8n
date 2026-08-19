import { WorkflowExecutor } from '../server/workflow/executor';

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

async function debugApproval() {
  const orgARes = await runAdminSql(`INSERT INTO public.organizations (name) VALUES ('Debug Org') RETURNING id;`);
  const orgA_id = orgARes.body.result[1][0];

  const wfAppRes = await runAdminSql(`INSERT INTO public.workflows (org_id, name, is_active) VALUES ('${orgA_id}', 'Debug Approval Wf', true) RETURNING id;`);
  const wfApproval_id = wfAppRes.body.result[1][0];

  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_id}', 1, 'http_request', '{"url":"https://httpbin.org/get"}');`);
  await runAdminSql(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfApproval_id}', 2, 'approval_gate', '{"message":"Please approve this step"}');`);

  const executor = new WorkflowExecutor(runAdminSql);
  console.log('Executing wfApproval...');
  const res = await executor.executeWorkflow({ workflow_id: wfApproval_id, org_id: orgA_id, trigger_type: 'manual' });
  console.log('Execution result:', res);

  const stepRuns = await runAdminSql(`SELECT id, status, workflow_step_id FROM public.step_runs WHERE workflow_run_id = '${res.workflow_run_id}';`);
  console.log('Step runs in DB:', stepRuns.body.result);
}

debugApproval();
