/**
 * AI Agent Workflow Builder — Webhook Ingestion API Route (Phase 4B)
 * POST /api/webhooks/[trigger_id]
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trigger_id: string }> }
) {
  try {
    const { trigger_id } = await context.params;
    let payload = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    const secretHeader = request.headers.get('x-webhook-secret') || undefined;

    const executor = new WorkflowExecutor(runAdminSql);
    const processor = new TriggerProcessor(executor, runAdminSql);

    const result = await processor.processWebhookTrigger({
      trigger_id,
      payload,
      secretHeader,
    });

    return NextResponse.json({
      success: true,
      workflow_run_id: result.workflow_run_id,
      status: result.status,
      output: result.output,
    });
  } catch (err) {
    const error = err as ExecutorError;
    const statusCode =
      error.code === 'UNAUTHORIZED_WEBHOOK'
        ? 401
        : error.code === 'TRIGGER_DISABLED' || error.code === 'INACTIVE_WORKFLOW'
        ? 400
        : error.code === 'WORKFLOW_NOT_FOUND'
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Webhook processing failed.',
        code: error.code || 'WEBHOOK_ERROR',
      },
      { status: statusCode }
    );
  }
}
