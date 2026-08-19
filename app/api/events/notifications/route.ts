/**
 * AI Agent Workflow Builder — Hasura Event Trigger API Route for Notifications (Phase 4B)
 * POST /api/events/notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowExecutor } from '@/server/workflow/executor';
import { TriggerProcessor } from '@/server/workflow/triggers';
import { ExecutorError } from '@/server/workflow/errors';

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

export async function POST(request: NextRequest) {
  try {
    const eventBody = await request.json();
    const secretHeader = request.headers.get('x-webhook-secret') || undefined;

    // Hasura Event Trigger Payload: { event: { data: { new: { id, ... } } } }
    const notificationId = eventBody?.event?.data?.new?.id || eventBody?.notification_id;

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'Missing notification ID in event payload.' }, { status: 400 });
    }

    const executor = new WorkflowExecutor(runAdminSql);
    const processor = new TriggerProcessor(executor, runAdminSql);

    const result = await processor.processNotificationDelivery(notificationId, secretHeader);

    return NextResponse.json(result);
  } catch (err) {
    const error = err as ExecutorError;
    const statusCode = error.code === 'UNAUTHORIZED_EVENT' ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Notification event processing failed.',
        code: error.code || 'EVENT_ERROR',
      },
      { status: statusCode }
    );
  }
}
