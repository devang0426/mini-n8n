/**
 * Connection Test API Endpoint (Phase P3)
 * POST /api/connections/[id]/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConnectionService } from '@/server/connections/service';

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

async function verifyOrgAccess(userId: string, orgId: string): Promise<string> {
  const sql = `
    SELECT role
    FROM public.org_members
    WHERE user_id = '${userId}' AND org_id = '${orgId}';
  `;

  const res = await runAdminSql(sql);
  const role = res.body?.result?.[1]?.[0];
  if (!role) {
    throw new Error(`Unauthorized: User '${userId}' is not a member of organization '${orgId}'.`);
  }
  return role;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: any = {};
    try { body = await request.json(); } catch {}

    const { searchParams } = new URL(request.url);
    const orgId = body?.org_id || searchParams.get('org_id');
    const callerUserId = request.headers.get('x-user-id') || body?.user_id || undefined;

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id parameter is required.' }, { status: 400 });
    }

    if (callerUserId) {
      const role = await verifyOrgAccess(callerUserId, orgId);
      if (role === 'viewer') {
        return NextResponse.json({ success: false, error: 'Viewers cannot test connections.' }, { status: 403 });
      }
    }

    const service = new ConnectionService(runAdminSql);
    const testResult = await service.testConnection(orgId, callerUserId, id);

    return NextResponse.json({
      success: testResult.success,
      status: testResult.status,
      message: testResult.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Connection test failed.' },
      { status: err.message?.includes('Unauthorized') ? 403 : 400 }
    );
  }
}
