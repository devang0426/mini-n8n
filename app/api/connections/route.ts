/**
 * Connections REST API Endpoint (Phase P3)
 * GET /api/connections?org_id=<uuid> -> Returns safe metadata array (EXCLUDES encrypted_credentials)
 * POST /api/connections -> Creates new connection
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

function extractUserIdFromHeader(req: NextRequest): string | undefined {
  let userId = req.headers.get('x-user-id') || req.headers.get('x-hasura-user-id');
  const authHeader = req.headers.get('authorization');
  if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  }

  if (!userId) return undefined;

  if (userId.startsWith('eyJ') || userId.length > 50) {
    try {
      const parts = userId.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        const nhostUserId =
          payload['https://hasura.io/jwt/claims']?.['x-hasura-user-id'] ||
          payload['https://hasura.io/jwt/claims']?.['X-Hasura-User-Id'] ||
          payload.sub ||
          payload.user_id ||
          payload.id;
        if (nhostUserId) {
          return nhostUserId;
        }
      }
    } catch {}
  }

  return userId;
}

/**
 * Helper to verify user's organization membership & role from Hasura org_members table.
 */
async function verifyOrgAccess(userId: string, orgId: string): Promise<string> {
  const sql = `
    SELECT role
    FROM public.org_members
    WHERE user_id = '${userId.replace(/'/g, "''")}' AND org_id = '${orgId.replace(/'/g, "''")}';
  `;

  const res = await runAdminSql(sql);
  const role = res.body?.result?.[1]?.[0];
  if (!role) {
    throw new Error(`Unauthorized: User is not a member of organization '${orgId}'.`);
  }
  return role;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const callerUserId = extractUserIdFromHeader(request);

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id query parameter is required.' }, { status: 400 });
    }

    if (callerUserId) {
      await verifyOrgAccess(callerUserId, orgId);
    }

    const service = new ConnectionService(runAdminSql);
    const connections = await service.getConnectionsMetadata(orgId);

    return NextResponse.json({ success: true, connections });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch connections metadata.' },
      { status: err.message?.includes('Unauthorized') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const callerUserId = extractUserIdFromHeader(request) || body?.user_id || undefined;
    const orgId = body?.org_id;

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id is required.' }, { status: 400 });
    }

    if (callerUserId) {
      const role = await verifyOrgAccess(callerUserId, orgId);
      if (role === 'viewer') {
        return NextResponse.json({ success: false, error: 'Viewers cannot create connections.' }, { status: 403 });
      }
    }

    const service = new ConnectionService(runAdminSql);
    const connection = await service.createConnection(
      orgId,
      callerUserId,
      body.name,
      body.provider,
      body.type,
      body.credentials,
      body.metadata
    );

    return NextResponse.json({ success: true, connection });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create connection.' },
      { status: err.message?.includes('Unauthorized') ? 403 : 400 }
    );
  }
}
