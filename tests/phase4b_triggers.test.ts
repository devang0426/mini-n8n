/**
 * AI Agent Workflow Builder — Phase 4B Event Triggers & Webhook Test Suite
 */

import { TriggerProcessor } from '../server/workflow/triggers';
import {
  WorkflowNotFoundError,
  InactiveWorkflowError,
  ExecutorError
} from '../server/workflow/errors';

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runPhase4BTests(
  processor: TriggerProcessor,
  adminSqlFn: (sql: string) => Promise<any>,
  webhookSecret: string,
  ids: {
    trigActive_id: string;
    trigDisabled_id: string;
    trigInactiveWf_id: string;
    notif_id: string;
  }
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function assert(name: string, passed: boolean, message = '') {
    results.push({ name, passed, message });
  }

  // 1. Valid Webhook Ingestion Executes Workflow
  try {
    const res = await processor.processWebhookTrigger({
      trigger_id: ids.trigActive_id,
      payload: { testKey: 'testVal' },
      secretHeader: webhookSecret
    });
    assert('1. Valid Webhook Ingestion executes workflow engine', res.status === 'completed' && !!res.workflow_run_id);
  } catch (err) {
    assert('1. Valid Webhook Ingestion executes workflow engine', false, (err as Error).message);
  }

  // 2. Invalid Webhook Secret Rejected
  try {
    await processor.processWebhookTrigger({
      trigger_id: ids.trigActive_id,
      payload: {},
      secretHeader: 'INVALID_SECRET'
    });
    assert('2. Invalid Webhook secret rejected', false, 'Expected UNAUTHORIZED_WEBHOOK error');
  } catch (err) {
    assert('2. Invalid Webhook secret rejected', err instanceof ExecutorError || (err as any).code === 'UNAUTHORIZED_WEBHOOK', (err as Error).message);
  }

  // 3. Disabled Webhook Trigger Rejected
  try {
    await processor.processWebhookTrigger({
      trigger_id: ids.trigDisabled_id,
      payload: {},
      secretHeader: webhookSecret
    });
    assert('3. Disabled Webhook trigger rejected', false, 'Expected TRIGGER_DISABLED error');
  } catch (err) {
    assert('3. Disabled Webhook trigger rejected', err instanceof ExecutorError || (err as any).code === 'TRIGGER_DISABLED', (err as Error).message);
  }

  // 4. Inactive Workflow Webhook Trigger Rejected
  try {
    await processor.processWebhookTrigger({
      trigger_id: ids.trigInactiveWf_id,
      payload: {},
      secretHeader: webhookSecret
    });
    assert('4. Inactive Workflow Webhook trigger rejected', false, 'Expected InactiveWorkflowError');
  } catch (err) {
    assert('4. Inactive Workflow Webhook trigger rejected', err instanceof InactiveWorkflowError || (err as any).code === 'INACTIVE_WORKFLOW', (err as Error).message);
  }

  // 5. Nonexistent Trigger Rejected
  try {
    await processor.processWebhookTrigger({
      trigger_id: '00000000-0000-0000-0000-000000000000',
      payload: {},
      secretHeader: webhookSecret
    });
    assert('5. Nonexistent Webhook trigger rejected', false, 'Expected WorkflowNotFoundError');
  } catch (err) {
    assert('5. Nonexistent Webhook trigger rejected', err instanceof WorkflowNotFoundError || (err as any).code === 'WORKFLOW_NOT_FOUND', (err as Error).message);
  }

  // 6. Notification Event Trigger Delivery Handler (Valid Secret)
  try {
    const res = await processor.processNotificationDelivery(ids.notif_id, webhookSecret);
    const dbNotif = (await adminSqlFn(`SELECT delivery_status, delivered_at FROM public.notifications WHERE id = '${ids.notif_id}';`)).body.result[1];
    assert('6. Notification delivery event updates status to delivered', res.success && dbNotif[0] === 'delivered' && !!dbNotif[1]);
  } catch (err) {
    assert('6. Notification delivery event updates status to delivered', false, (err as Error).message);
  }

  // 7. Notification Event Trigger Delivery Handler (Invalid Secret)
  try {
    await processor.processNotificationDelivery(ids.notif_id, 'INVALID_SECRET');
    assert('7. Event Trigger invalid secret rejected', false, 'Expected UNAUTHORIZED_EVENT error');
  } catch (err) {
    assert('7. Event Trigger invalid secret rejected', err instanceof ExecutorError || (err as any).code === 'UNAUTHORIZED_EVENT', (err as Error).message);
  }

  return results;
}
