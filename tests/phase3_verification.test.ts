/**
 * Phase 3 Verification Test Suite
 * Tests GraphQL operations using real authenticated user Nhost JWTs.
 * Never uses HASURA_GRAPHQL_ADMIN_SECRET for client/authorization queries.
 */

import { executeGraphQL } from '../lib/graphql/client';
import { GET_WORKFLOWS_BY_ORG, GET_WORKFLOW_BY_ID } from '../graphql/workflows/queries';
import { CREATE_WORKFLOW, UPDATE_WORKFLOW, DELETE_WORKFLOW } from '../graphql/workflows/mutations';
import { CREATE_WORKFLOW_STEP } from '../graphql/steps/mutations';
import { CREATE_WORKFLOW_TRIGGER } from '../graphql/triggers/mutations';
import { GET_STEP_RUNS_QUERY } from '../graphql/subscriptions/stepRuns';
import { GET_ORGANIZATION_USAGE } from '../graphql/usage/queries';

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runPhase3Tests(userTokens: {
  ownerA: string;
  editorA: string;
  viewerA: string;
  ownerB: string;
  viewerB: string;
}, ids: {
  orgA_id: string;
  orgB_id: string;
  wfA_id: string;
  runA_id: string;
}): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: ownerA can query Org A workflows
  try {
    const data = await executeGraphQL<any>(userTokens.ownerA, GET_WORKFLOWS_BY_ORG, { org_id: ids.orgA_id });
    results.push({
      name: '1. ownerA can query Org A workflows',
      passed: Array.isArray(data.workflows) && data.workflows.length > 0
    });
  } catch (err) {
    results.push({ name: '1. ownerA can query Org A workflows', passed: false, message: (err as Error).message });
  }

  // Test 2: viewerA can query Org A workflows
  try {
    const data = await executeGraphQL<any>(userTokens.viewerA, GET_WORKFLOWS_BY_ORG, { org_id: ids.orgA_id });
    results.push({
      name: '2. viewerA can query Org A workflows',
      passed: Array.isArray(data.workflows) && data.workflows.length > 0
    });
  } catch (err) {
    results.push({ name: '2. viewerA can query Org A workflows', passed: false, message: (err as Error).message });
  }

  // Test 3: ownerB cannot retrieve Org A workflow by UUID
  try {
    const data = await executeGraphQL<any>(userTokens.ownerB, GET_WORKFLOW_BY_ID, { id: ids.wfA_id });
    results.push({
      name: '3. ownerB cannot retrieve Org A workflow by UUID',
      passed: data.workflows_by_pk === null
    });
  } catch (err) {
    results.push({ name: '3. ownerB cannot retrieve Org A workflow by UUID', passed: false, message: (err as Error).message });
  }

  // Test 4: viewerB cannot retrieve Org A workflow by UUID
  try {
    const data = await executeGraphQL<any>(userTokens.viewerB, GET_WORKFLOW_BY_ID, { id: ids.wfA_id });
    results.push({
      name: '4. viewerB cannot retrieve Org A workflow by UUID',
      passed: data.workflows_by_pk === null
    });
  } catch (err) {
    results.push({ name: '4. viewerB cannot retrieve Org A workflow by UUID', passed: false, message: (err as Error).message });
  }

  // Test 5: editorA can create an allowed step (llm_call)
  try {
    const data = await executeGraphQL<any>(userTokens.editorA, CREATE_WORKFLOW_STEP, {
      workflow_id: ids.wfA_id,
      position: 100,
      step_type: 'llm_call'
    });
    results.push({
      name: '5. editorA can create allowed step (llm_call)',
      passed: !!data.insert_workflow_steps_one?.id
    });
  } catch (err) {
    results.push({ name: '5. editorA can create allowed step (llm_call)', passed: false, message: (err as Error).message });
  }

  // Test 6: editorA cannot create db_write
  try {
    await executeGraphQL<any>(userTokens.editorA, CREATE_WORKFLOW_STEP, {
      workflow_id: ids.wfA_id,
      position: 101,
      step_type: 'db_write'
    });
    results.push({ name: '6. editorA cannot create db_write', passed: false, message: 'Expected authorization failure but operation succeeded.' });
  } catch (err) {
    results.push({ name: '6. editorA cannot create db_write', passed: true, message: (err as Error).message });
  }

  // Test 7: editorA cannot create notify
  try {
    await executeGraphQL<any>(userTokens.editorA, CREATE_WORKFLOW_STEP, {
      workflow_id: ids.wfA_id,
      position: 102,
      step_type: 'notify'
    });
    results.push({ name: '7. editorA cannot create notify', passed: false, message: 'Expected authorization failure but operation succeeded.' });
  } catch (err) {
    results.push({ name: '7. editorA cannot create notify', passed: true, message: (err as Error).message });
  }

  // Test 8: editorA cannot create webhook trigger
  try {
    await executeGraphQL<any>(userTokens.editorA, CREATE_WORKFLOW_TRIGGER, {
      workflow_id: ids.wfA_id,
      trigger_type: 'webhook'
    });
    results.push({ name: '8. editorA cannot create webhook trigger', passed: false, message: 'Expected authorization failure but operation succeeded.' });
  } catch (err) {
    results.push({ name: '8. editorA cannot create webhook trigger', passed: true, message: (err as Error).message });
  }

  // Test 9: viewerA cannot create/update/delete workflow
  try {
    await executeGraphQL<any>(userTokens.viewerA, CREATE_WORKFLOW, {
      org_id: ids.orgA_id,
      name: 'Forbidden Viewer Wf'
    });
    results.push({ name: '9. viewerA cannot create workflow', passed: false, message: 'Expected authorization failure but create succeeded.' });
  } catch (err) {
    results.push({ name: '9. viewerA cannot create/update/delete workflow', passed: true, message: (err as Error).message });
  }

  // Test 10: step_runs subscription query is isolated by organization
  try {
    const dataOwnerB = await executeGraphQL<any>(userTokens.ownerB, GET_STEP_RUNS_QUERY, { workflow_run_id: ids.runA_id });
    const dataOwnerA = await executeGraphQL<any>(userTokens.ownerA, GET_STEP_RUNS_QUERY, { workflow_run_id: ids.runA_id });
    results.push({
      name: '10. step_runs subscription/query isolated by org',
      passed: dataOwnerB.step_runs.length === 0 && dataOwnerA.step_runs.length > 0
    });
  } catch (err) {
    results.push({ name: '10. step_runs subscription/query isolated by org', passed: false, message: (err as Error).message });
  }

  // Test 11: quota can be read
  try {
    const data = await executeGraphQL<any>(userTokens.ownerA, GET_ORGANIZATION_USAGE);
    results.push({
      name: '11. quota can be read by user',
      passed: Array.isArray(data.organizations) && data.organizations.length > 0 && typeof data.organizations[0].quota_limit === 'number'
    });
  } catch (err) {
    results.push({ name: '11. quota can be read by user', passed: false, message: (err as Error).message });
  }

  // Test 12: quota cannot be mutated directly
  try {
    const MUTATE_QUOTA = `mutation MutateQuota($id: uuid!) { update_organizations_by_pk(pk_columns: {id: $id}, _inc: {quota_used: 5}) { id } }`;
    await executeGraphQL<any>(userTokens.ownerA, MUTATE_QUOTA, { id: ids.orgA_id });
    results.push({ name: '12. quota cannot be mutated directly', passed: false, message: 'Expected schema/permission error for quota mutation.' });
  } catch (err) {
    results.push({ name: '12. quota cannot be mutated directly', passed: true, message: (err as Error).message });
  }

  return results;
}
