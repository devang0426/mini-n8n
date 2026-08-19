/**
 * AI Agent Workflow Builder — Webhook & Event Trigger Processing (Phase 4B)
 */

import { WorkflowExecutor } from './executor';
import { ExecutionResult } from './types';
import {
  WorkflowNotFoundError,
  InactiveWorkflowError,
  ExecutorError,
  ValidationError
} from './errors';

export interface WebhookIngestParams {
  trigger_id: string;
  payload: Record<string, unknown>;
  secretHeader?: string;
}

export class TriggerProcessor {
  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly adminSqlFn: (sql: string) => Promise<any>
  ) {}

  /**
   * Processes an incoming webhook trigger ingestion request.
   */
  public async processWebhookTrigger(params: WebhookIngestParams): Promise<ExecutionResult> {
    if (!params.trigger_id) {
      throw new ValidationError('trigger_id is required for webhook ingestion.');
    }

    // Secret Verification if configured in environment
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && params.secretHeader !== expectedSecret) {
      throw new ExecutorError('Invalid or missing webhook secret header.', 'UNAUTHORIZED_WEBHOOK');
    }

    // 1. Lookup workflow_trigger & join workflow details
    const sql = `
      SELECT
        wt.id AS trigger_id,
        wt.workflow_id,
        wt.trigger_type,
        wt.is_enabled,
        w.org_id,
        w.is_active
      FROM public.workflow_triggers wt
      JOIN public.workflows w ON wt.workflow_id = w.id
      WHERE wt.id = '${params.trigger_id}';
    `;

    const res = await this.adminSqlFn(sql);
    const row = res.body?.result?.[1];

    if (!row) {
      throw new WorkflowNotFoundError(`Trigger ID '${params.trigger_id}' not found.`);
    }

    const [triggerId, workflowId, triggerType, isEnabledStr, orgId, isActiveStr] = row;
    const isEnabled = isEnabledStr === 't' || isEnabledStr === true || isEnabledStr === 'true';
    const isActive = isActiveStr === 't' || isActiveStr === true || isActiveStr === 'true';

    if (triggerType !== 'webhook') {
      throw new ValidationError(`Trigger '${params.trigger_id}' is of type '${triggerType}', not 'webhook'.`);
    }

    if (!isEnabled) {
      throw new ExecutorError(`Webhook trigger '${params.trigger_id}' is disabled.`, 'TRIGGER_DISABLED');
    }

    if (!isActive) {
      throw new InactiveWorkflowError(workflowId);
    }

    // 2. Invoke Workflow Execution Engine
    return this.executor.executeWorkflow({
      workflow_id: workflowId,
      org_id: orgId,
      trigger_type: 'webhook',
      input: params.payload
    });
  }

  /**
   * Processes a notification event delivery trigger (Hasura Event Trigger).
   */
  public async processNotificationDelivery(
    notificationId: string,
    secretHeader?: string
  ): Promise<{ success: boolean; notification_id: string; delivery_status: string }> {
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && secretHeader !== expectedSecret) {
      throw new ExecutorError('Invalid or missing webhook secret header.', 'UNAUTHORIZED_EVENT');
    }

    // Update notification status to 'delivered'
    const sql = `
      UPDATE public.notifications
      SET delivery_status = 'delivered', delivered_at = now(), updated_at = now()
      WHERE id = '${notificationId}' AND delivery_status = 'pending'
      RETURNING id, org_id, recipient, channel;
    `;

    const res = await this.adminSqlFn(sql);
    const row = res.body?.result?.[1];

    if (!row) {
      return { success: false, notification_id: notificationId, delivery_status: 'not_found_or_already_processed' };
    }

    const [id, orgId, recipient, channel] = row;

    // Record Audit Log: notification.delivered
    try {
      await this.adminSqlFn(`
        INSERT INTO public.audit_logs (org_id, action, resource_type, resource_id, metadata)
        VALUES ('${orgId}', 'notification.delivered', 'notification', '${id}', '{"channel":"${channel}","recipient":"${recipient}"}'::jsonb);
      `);
    } catch {
      // Non-blocking audit log
    }

    return {
      success: true,
      notification_id: id,
      delivery_status: 'delivered'
    };
  }
}
