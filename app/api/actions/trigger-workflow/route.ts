/**
 * AI Agent Workflow Builder — triggerWorkflowRun Hasura Action API Route (Phase 5)
 * POST /api/actions/trigger-workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowExecutor } from '@/server/workflow/executor';
import { ActionProcessor, ActionError } from '@/server/workflow/actions';
import { sanitizeText } from '@/server/workflow/sanitizer';

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
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // SECURITY: Authenticated caller user ID MUST come EXCLUSIVELY from trusted Hasura session_variables.
    // Client-supplied HTTP headers (e.g. request.headers.get('x-hasura-user-id')) and input body overrides are NEVER trusted.
    const callerUserId =
      body?.session_variables?.['x-hasura-user-id'] ||
      body?.session_variables?.['X-Hasura-User-Id'] ||
      undefined;

    const workflow_id = body?.input?.workflow_id || body?.workflow_id;

    const executor = new WorkflowExecutor(runAdminSql);
    const processor = new ActionProcessor(executor, runAdminSql);

    const result = await processor.triggerWorkflowRun({
      workflow_id,
      callerUserId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const errorMsg = sanitizeText(err.message || 'Workflow trigger failed.');
    let statusCode = 500;
    let errorCode = err.code || 'ACTION_ERROR';

    if (err instanceof ActionError) {
      statusCode = err.statusCode;
    } else if (err.code === 'WORKFLOW_NOT_FOUND') {
      statusCode = 404;
    } else if (err.code === 'INACTIVE_WORKFLOW' || err.code === 'QUOTA_EXHAUSTED' || err.code === 'INVALID_INPUT') {
      statusCode = 400;
    } else if (err.code === 'CROSS_ORG_ACCESS_DENIED' || err.code === 'VIEWER_NOT_PERMITTED' || err.code === 'UNAUTHORIZED_ROLE') {
      statusCode = 403;
    } else if (err.code === 'UNAUTHENTICATED') {
      statusCode = 401;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        code: errorCode,
        message: errorMsg,
      },
      { status: statusCode }
    );
  }
}
