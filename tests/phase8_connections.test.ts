/**
 * AI Agent Workflow Builder — Phase 8 Connections & Credential Security Test Suite (Phase P3)
 */

import { encryptCredential, decryptCredential } from '../server/security/encryption';
import { ConnectionService } from '../server/connections/service';
import { WorkflowExecutor } from '../server/workflow/executor';
import { StepRunner } from '../server/workflow/step-runner';

export interface TestResult {
  assertion: number;
  category: string;
  name: string;
  passed: boolean;
  message?: string;
}

export async function runConnectionsTests(
  executor: WorkflowExecutor,
  adminSqlFn: (sql: string) => Promise<any>
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  let assertionCount = 0;

  function assert(category: string, name: string, condition: boolean, message?: string) {
    assertionCount++;
    results.push({
      assertion: assertionCount,
      category,
      name,
      passed: condition,
      message,
    });
  }

  const connService = new ConnectionService(adminSqlFn);

  // Setup Test Fixtures: Create Org A and Org B
  const orgAId = (await adminSqlFn(`INSERT INTO public.organizations (name) VALUES ('Test Connections Org A') RETURNING id;`)).body?.result?.[1]?.[0];
  const orgBId = (await adminSqlFn(`INSERT INTO public.organizations (name) VALUES ('Test Connections Org B') RETURNING id;`)).body?.result?.[1]?.[0];

  const userAId = (await adminSqlFn(`SELECT id FROM auth.users LIMIT 1;`)).body?.result?.[1]?.[0] || undefined;

  let connAId = '';

  // 1. Encryption & Decryption Tests
  try {
    const rawCred = { api_key: 'groq_sk_test_123456789' };
    const encrypted = encryptCredential(rawCred);
    const decrypted = decryptCredential(encrypted);

    assert('Encryption', 'AES-256-GCM encrypts and decrypts credentials accurately', decrypted.api_key === rawCred.api_key);
    assert('Encryption', 'Encrypted format follows v1.<iv>.<tag>.<ciphertext> structure', encrypted.startsWith('v1.') && encrypted.split('.').length === 4);

    const enc1 = encryptCredential(rawCred);
    const enc2 = encryptCredential(rawCred);
    assert('Encryption', 'Unique IV generated for every encryption operation', enc1 !== enc2);
  } catch (err: any) {
    assert('Encryption', 'AES-256-GCM encryption tests', false, err.message);
  }

  // 2. Tampered Ciphertext Rejection
  try {
    const validEnc = encryptCredential({ secret: 'supersecret' });
    const tampered = validEnc.substring(0, validEnc.length - 4) + 'abcd';
    let failedAsExpected = false;
    try {
      decryptCredential(tampered);
    } catch {
      failedAsExpected = true;
    }
    assert('Encryption', 'Tampered ciphertext is rejected during decryption', failedAsExpected);
  } catch (err: any) {
    assert('Encryption', 'Tampered ciphertext rejection', false, err.message);
  }

  // 3. Create Connection
  try {
    const created = await connService.createConnection(
      orgAId,
      userAId,
      'Groq Production AI',
      'groq',
      'llm',
      { api_key: 'groq_sk_production_secret_key' },
      { model: 'llama-3-70b' }
    );

    connAId = created.id;
    assert('Service', 'Create Connection succeeds and returns safe metadata', created.id !== undefined && created.name === 'Groq Production AI');
    assert('Service', 'New connection status defaults to Not tested', created.status === 'Not tested');
  } catch (err: any) {
    assert('Service', 'Create Connection', false, err.message);
  }

  // 4. Metadata Queries Omit Credentials
  try {
    const list = await connService.getConnectionsMetadata(orgAId);
    const target = list.find((c) => c.id === connAId);

    assert('Security', 'Metadata query returns safe connection summary', target !== undefined);
    assert('Security', 'Encrypted credentials are never returned in metadata listing', (target as any)?.encrypted_credentials === undefined);
  } catch (err: any) {
    assert('Security', 'Metadata queries omit credentials', false, err.message);
  }

  // 5. Test Connection Ping
  try {
    const testRes = await connService.testConnection(orgAId, userAId, connAId);
    assert('Testing', 'Test connection ping succeeds and updates status to Connected', testRes.success && testRes.status === 'Connected');

    // Confirm DB status updated
    const updatedList = await connService.getConnectionsMetadata(orgAId);
    const updatedTarget = updatedList.find((c) => c.id === connAId);
    assert('Testing', 'Database connection status updated to Connected', updatedTarget?.status === 'Connected');
  } catch (err: any) {
    assert('Testing', 'Test Connection Ping', false, err.message);
  }

  // 6. Update Connection & Secret Rotation
  try {
    const updated = await connService.updateConnection(
      orgAId,
      userAId,
      connAId,
      'Groq Production AI (Rotated)',
      { api_key: 'groq_sk_rotated_new_secret_key' }
    );

    assert('Rotation', 'Update Connection re-encrypts new credentials (secret rotation)', updated.name === 'Groq Production AI (Rotated)');
    assert('Rotation', 'Secret rotation resets status to Not tested', updated.status === 'Not tested');

    const decryptedNew = await connService.getConnectionDecrypted(orgAId, connAId);
    assert('Rotation', 'Decrypted credentials reflect updated rotated key', decryptedNew.credentials.api_key === 'groq_sk_rotated_new_secret_key');
  } catch (err: any) {
    assert('Rotation', 'Secret rotation', false, err.message);
  }

  // 7. Cross-Org Connection Protection
  try {
    let orgBDenied = false;
    try {
      await connService.getConnectionDecrypted(orgBId, connAId);
    } catch {
      orgBDenied = true;
    }
    assert('Isolation', 'Org B cannot decrypt or access Org A connection by ID', orgBDenied);

    let orgBUpdateDenied = false;
    try {
      await connService.updateConnection(orgBId, userAId, connAId, 'Hacked Name');
    } catch {
      orgBUpdateDenied = true;
    }
    assert('Isolation', 'Org B cannot update Org A connection by ID', orgBUpdateDenied);

    let orgBDeleteDenied = false;
    try {
      await connService.deleteConnection(orgBId, userAId, connAId);
    } catch {
      orgBDeleteDenied = true;
    }
    assert('Isolation', 'Org B cannot delete Org A connection by ID', orgBDeleteDenied);

    let orgBTestDenied = false;
    try {
      await connService.testConnection(orgBId, userAId, connAId);
    } catch {
      orgBTestDenied = true;
    }
    assert('Isolation', 'Org B cannot test Org A connection by ID', orgBTestDenied);
  } catch (err: any) {
    assert('Isolation', 'Cross-Org Isolation', false, err.message);
  }

  // 8. Connection-backed LLM Execution & Legacy Fallback
  try {
    // Legacy Fallback (without connection_id)
    const legacyResult = await StepRunner.executeStep(
      'llm_call',
      {
        workflowInput: { prompt: 'Test prompt' },
        previousOutput: {},
        stepConfig: { prompt: 'Legacy LLM test' },
        workflowRunId: '00000000-0000-0000-0000-000000000001',
        stepRunId: '00000000-0000-0000-0000-000000000002',
        orgId: orgAId,
        attemptCount: 1,
      },
      adminSqlFn
    );
    assert('Execution', 'Legacy LLM call without connection_id falls back to LLM_API_KEY', legacyResult.status === 'completed');

    // Connection-backed LLM call
    const connResult = await StepRunner.executeStep(
      'llm_call',
      {
        workflowInput: { prompt: 'Test prompt' },
        previousOutput: {},
        stepConfig: { prompt: 'Connection-backed LLM test', connection_id: connAId },
        workflowRunId: '00000000-0000-0000-0000-000000000001',
        stepRunId: '00000000-0000-0000-0000-000000000003',
        orgId: orgAId,
        attemptCount: 1,
      },
      adminSqlFn
    );
    assert('Execution', 'Connection-backed LLM call resolves decrypted credential server-side', connResult.status === 'completed');
  } catch (err: any) {
    assert('Execution', 'LLM Execution with Connection', false, err.message);
  }

  // 9. Connection Delete Safety (Reference Protection)
  try {
    // Create workflow and step in Org A referencing connAId
    const wfId = (await adminSqlFn(`INSERT INTO public.workflows (org_id, name) VALUES ('${orgAId}', 'In-Use Workflow') RETURNING id;`)).body?.result?.[1]?.[0];
    await adminSqlFn(`INSERT INTO public.workflow_steps (workflow_id, position, step_type, config) VALUES ('${wfId}', 1, 'llm_call', '{"connection_id":"${connAId}"}'::jsonb);`);

    let deleteBlocked = false;
    let errorMsg = '';
    try {
      await connService.deleteConnection(orgAId, userAId, connAId);
    } catch (err: any) {
      deleteBlocked = true;
      errorMsg = err.message;
    }

    assert('ReferenceSafety', 'Delete connection is blocked when referenced by active workflow step', deleteBlocked);
    assert('ReferenceSafety', 'Error message specifies number of referencing workflow steps', errorMsg.includes('used by 1 workflow step'));

    // Remove referencing step & verify delete succeeds
    await adminSqlFn(`DELETE FROM public.workflow_steps WHERE workflow_id = '${wfId}';`);
    await connService.deleteConnection(orgAId, userAId, connAId);
    assert('ReferenceSafety', 'Delete connection succeeds after referencing step is removed', true);
  } catch (err: any) {
    assert('ReferenceSafety', 'Connection Delete Safety', false, err.message);
  }

  // Cleanup Test Orgs
  await adminSqlFn(`DELETE FROM public.organizations WHERE id IN ('${orgAId}', '${orgBId}');`);

  return results;
}
