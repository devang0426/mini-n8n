/**
 * Phase 6A — Integration & Security Verification Suite (Suite A)
 * Tests authenticated Nhost JWTs, org membership isolation, cross-org workflow isolation,
 * GraphQL authorization, and client secret audit.
 */

import { executeGraphQL } from '../lib/graphql/client';
import { GET_USER_ORGANIZATIONS } from '../graphql/organizations/queries';
import { GET_WORKFLOWS_BY_ORG, GET_WORKFLOW_BY_ID } from '../graphql/workflows/queries';
import * as fs from 'fs';
import * as path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runIntegrationAndSecurityTests(
  tokens: {
    userA: string;
    userB: string;
  },
  userIDs: {
    userA_id: string;
    userB_id: string;
  },
  orgIDs: {
    orgA_id: string;
    orgB_id: string;
  },
  wfIDs: {
    wfA_id: string;
    wfB_id: string;
  }
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test A1: Authenticated User A JWT retrieves only Org A membership via GraphQL
  try {
    const data = await executeGraphQL<any>(tokens.userA, GET_USER_ORGANIZATIONS);
    const memberOrgs = data.org_members || [];
    const hasOrgA = memberOrgs.some((m: any) => m.org_id === orgIDs.orgA_id);
    const hasOrgB = memberOrgs.some((m: any) => m.org_id === orgIDs.orgB_id);

    results.push({
      name: 'A1. Authenticated User A JWT retrieves Org A membership and NOT Org B',
      passed: hasOrgA && !hasOrgB,
      message: !hasOrgA ? 'Missing Org A' : hasOrgB ? 'Leak: User A sees Org B' : undefined,
    });
  } catch (err) {
    results.push({
      name: 'A1. Authenticated User A JWT retrieves Org A membership and NOT Org B',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test A2: Authenticated User B JWT retrieves only Org B membership via GraphQL
  try {
    const data = await executeGraphQL<any>(tokens.userB, GET_USER_ORGANIZATIONS);
    const memberOrgs = data.org_members || [];
    const hasOrgB = memberOrgs.some((m: any) => m.org_id === orgIDs.orgB_id);
    const hasOrgA = memberOrgs.some((m: any) => m.org_id === orgIDs.orgA_id);

    results.push({
      name: 'A2. Authenticated User B JWT retrieves Org B membership and NOT Org A',
      passed: hasOrgB && !hasOrgA,
      message: !hasOrgB ? 'Missing Org B' : hasOrgA ? 'Leak: User B sees Org A' : undefined,
    });
  } catch (err) {
    results.push({
      name: 'A2. Authenticated User B JWT retrieves Org B membership and NOT Org A',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test A3: User A can query Org A workflows via GraphQL
  try {
    const data = await executeGraphQL<any>(tokens.userA, GET_WORKFLOWS_BY_ORG, { org_id: orgIDs.orgA_id });
    const wfs = data.workflows || [];
    results.push({
      name: 'A3. User A can query Org A workflows via GraphQL',
      passed: Array.isArray(wfs) && wfs.length > 0 && wfs[0].id === wfIDs.wfA_id,
      message: `Expected workflow ${wfIDs.wfA_id}, got: ${JSON.stringify(wfs)}`,
    });
  } catch (err) {
    results.push({
      name: 'A3. User A can query Org A workflows via GraphQL',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test A4: User B cannot retrieve Org A workflows via GET_WORKFLOWS_BY_ORG
  try {
    const data = await executeGraphQL<any>(tokens.userB, GET_WORKFLOWS_BY_ORG, { org_id: orgIDs.orgA_id });
    const wfs = data.workflows || [];
    results.push({
      name: 'A4. User B cannot retrieve Org A workflows via GET_WORKFLOWS_BY_ORG',
      passed: Array.isArray(wfs) && wfs.length === 0,
      message: `Leak: User B returned ${wfs.length} workflows for Org A`,
    });
  } catch (err) {
    results.push({
      name: 'A4. User B cannot retrieve Org A workflows via GET_WORKFLOWS_BY_ORG',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test A5: User B cannot retrieve known Org A workflow UUID via GET_WORKFLOW_BY_ID
  try {
    const data = await executeGraphQL<any>(tokens.userB, GET_WORKFLOW_BY_ID, { id: wfIDs.wfA_id });
    results.push({
      name: 'A5. User B cannot retrieve known Org A workflow UUID via GET_WORKFLOW_BY_ID',
      passed: data.workflows_by_pk === null,
      message: data.workflows_by_pk ? 'Leak: User B fetched Org A workflow by PK' : undefined,
    });
  } catch (err) {
    results.push({
      name: 'A5. User B cannot retrieve known Org A workflow UUID via GET_WORKFLOW_BY_ID',
      passed: false,
      message: (err as Error).message,
    });
  }

  // Test A6: Unauthenticated GraphQL request (invalid JWT) is rejected with AuthenticationError
  try {
    await executeGraphQL<any>('invalid.jwt.token', GET_USER_ORGANIZATIONS);
    results.push({
      name: 'A6. Unauthenticated GraphQL request is rejected safely',
      passed: false,
      message: 'Expected request to fail with unauthenticated/invalid token error',
    });
  } catch (err) {
    results.push({
      name: 'A6. Unauthenticated GraphQL request is rejected safely',
      passed: true,
    });
  }

  // Test A7: Client source code secret exposure audit
  try {
    const clientDirs = ['app', 'components', 'hooks', 'lib'];
    const secretsToSearch = [
      process.env.HASURA_GRAPHQL_ADMIN_SECRET,
      process.env.LLM_API_KEY,
      process.env.WEBHOOK_SECRET,
    ].filter(Boolean) as string[];

    let leakedSecretFound = false;
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
              leakedSecretFound = true;
              leakDetails += `Secret leaked in ${fullPath}; `;
            }
          }
          if (content.includes('HASURA_GRAPHQL_ADMIN_SECRET') && !fullPath.includes('api')) {
            leakedSecretFound = true;
            leakDetails += `HASURA_GRAPHQL_ADMIN_SECRET string referenced in client file ${fullPath}; `;
          }
        }
      }
    }

    for (const dir of clientDirs) {
      searchDirectory(path.join(rootDir, dir));
    }

    results.push({
      name: 'A7. Zero server secrets (ADMIN_SECRET, LLM_API_KEY, WEBHOOK_SECRET) in client source code',
      passed: !leakedSecretFound,
      message: leakedSecretFound ? leakDetails : undefined,
    });
  } catch (err) {
    results.push({
      name: 'A7. Zero server secrets in client source code',
      passed: false,
      message: (err as Error).message,
    });
  }

  return results;
}
