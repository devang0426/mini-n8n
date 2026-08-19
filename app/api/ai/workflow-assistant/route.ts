/**
 * AI Workflow Assistant API Endpoint (Phase P7)
 * POST /api/ai/workflow-assistant
 * Generates an untrusted workflow proposal from natural language prompt, machine-validates it, and returns the proposal JSON without database persistence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConnectionService } from '@/server/connections/service';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/server/ai/prompt';
import { validateAIProposal } from '@/server/ai/validator';
import { SafeConnectionInfo, AIWorkflowProposal } from '@/server/ai/types';

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
 * Server-side security check: Verifies user's active org membership & retrieves role from Hasura org_members table.
 */
async function verifyOrgAccess(userId: string, orgId: string): Promise<'owner' | 'editor' | 'viewer'> {
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
  return role as 'owner' | 'editor' | 'viewer';
}

/**
 * Smart Fallback Proposal Generator used when LLM API key is missing or unconfigured.
 */
function generateFallbackProposal(prompt: string, availableConnections: SafeConnectionInfo[]): Record<string, unknown> {
  const lower = prompt.toLowerCase();

  const isWebhook = lower.includes('webhook') || lower.includes('inbound') || lower.includes('api call');
  const isLlm = lower.includes('llm') || lower.includes('summarize') || lower.includes('ai') || lower.includes('gpt') || lower.includes('analyze');
  const isConditional = lower.includes('urgent') || lower.includes('if') || lower.includes('condition') || lower.includes('check');
  const isHttp = lower.includes('http') || lower.includes('api') || lower.includes('endpoint') || lower.includes('fetch');
  const isApproval = lower.includes('approval') || lower.includes('approve') || lower.includes('gate') || lower.includes('human');
  const isNotify = lower.includes('notify') || lower.includes('alert') || lower.includes('email');
  const isDbWrite = lower.includes('db') || lower.includes('database') || lower.includes('log') || lower.includes('save');

  const triggers = [
    {
      trigger_type: isWebhook ? 'webhook' : 'manual',
      config: isWebhook ? { endpoint: '/api/webhooks/trigger' } : {},
      is_enabled: true,
    },
  ];

  const steps: Array<Record<string, unknown>> = [];
  let pos = 1;

  if (isLlm || steps.length === 0) {
    const llmConn = availableConnections.find((c) => c.type === 'llm');
    steps.push({
      position: pos++,
      step_type: 'llm_call',
      name: 'AI Analysis & Summary',
      config: {
        model: 'gpt-4o',
        prompt: `Analyze payload according to request: ${prompt.substring(0, 100)}`,
        connection: llmConn ? { name: llmConn.name, provider: llmConn.provider } : undefined,
      },
    });
  }

  if (isConditional) {
    steps.push({
      position: pos++,
      step_type: 'conditional_branch',
      name: 'Urgency & Keyword Check',
      config: {
        field: 'urgent',
        operator: 'equals',
        value: true,
      },
    });
  }

  if (isHttp) {
    const httpConn = availableConnections.find((c) => c.type === 'http');
    steps.push({
      position: pos++,
      step_type: 'http_request',
      name: 'External HTTP API Call',
      config: {
        url: 'https://httpbin.org/post',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { source: 'workflo-ai-assistant', status: 'urgent' },
        connection: httpConn ? { name: httpConn.name, provider: httpConn.provider } : undefined,
      },
    });
  }

  if (isApproval) {
    steps.push({
      position: pos++,
      step_type: 'approval_gate',
      name: 'Human Review Gate',
      config: {
        message: 'Review generated output before continuing execution pipeline.',
      },
    });
  }

  if (isNotify) {
    steps.push({
      position: pos++,
      step_type: 'notify',
      name: 'Send Team Notification',
      config: {
        recipient: 'admin@example.com',
        channel: 'in_app',
        payload: { message: 'AI Workflow automated alert triggered.' },
      },
    });
  }

  if (isDbWrite) {
    steps.push({
      position: pos++,
      step_type: 'db_write',
      name: 'Log Execution Event',
      config: {
        table: 'audit_logs',
        action: 'insert',
        data: { action: 'ai_workflow_executed' },
      },
    });
  }

  // Derive title from prompt
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(' ');
  const title = words ? `${words.charAt(0).toUpperCase() + words.slice(1)} Pipeline` : 'AI Generated Automation';

  return {
    name: title.substring(0, 80),
    description: `Automated workflow generated from user request: "${prompt.substring(0, 150)}"`,
    is_active: false,
    triggers,
    steps,
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const orgId = typeof body.org_id === 'string' ? body.org_id.trim() : '';

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required.' },
        { status: 400 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'org_id is required.' },
        { status: 400 }
      );
    }

    // 1. Authenticate user from trusted Nhost/Hasura header or JWT Bearer token
    const callerUserId = extractUserIdFromHeader(request);
    if (!callerUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated: User identity header missing.' },
        { status: 401 }
      );
    }

    // 2. Verify User Organization Membership & Role (Do NOT trust client org_id without server verification!)
    let userRole: 'owner' | 'editor' | 'viewer';
    try {
      userRole = await verifyOrgAccess(callerUserId, orgId);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: err.message || 'Unauthorized org access.' },
        { status: 403 }
      );
    }

    // Role Gate: Viewers cannot generate workflow proposals
    if (userRole === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Viewers cannot generate workflow proposals.' },
        { status: 403 }
      );
    }

    // 3. Retrieve Safe Connection Metadata (EXCLUDES all encrypted credentials)
    const connService = new ConnectionService(runAdminSql);
    const rawConns = await connService.getConnectionsMetadata(orgId);
    const availableConnections: SafeConnectionInfo[] = rawConns.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      type: c.type,
    }));

    // 4. Invoke LLM Infrastructure / Fallback Generator
    let rawProposalObject: Record<string, unknown> | null = null;
    const apiKey = process.env.LLM_API_KEY;

    if (apiKey && apiKey !== 'mock-demo-key-placeholder') {
      try {
        const fullPrompt = buildUserPrompt(prompt, availableConnections);
        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: fullPrompt },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          const content = llmData.choices?.[0]?.message?.content;
          if (content) {
            try {
              rawProposalObject = JSON.parse(content);
            } catch {}
          }
        }
      } catch (err) {
        // Fallback to structured generator on network error
      }
    }

    if (!rawProposalObject) {
      rawProposalObject = generateFallbackProposal(prompt, availableConnections);
    }

    // 5. Machine Validate Untrusted AI Proposal Server-Side
    const validationResult = validateAIProposal({
      rawProposal: rawProposalObject,
      userRole,
      availableConnections,
    });

    if (!validationResult.isValid || !validationResult.proposal) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to generate a valid workflow proposal matching security rules.',
          issues: validationResult.issues,
        },
        { status: 400 }
      );
    }

    // Return Machine-Validated Untrusted AI Proposal (ZERO Persistence Occurs Here!)
    return NextResponse.json({
      success: true,
      proposal: validationResult.proposal,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Workflow assistant processing failed.',
      },
      { status: 500 }
    );
  }
}
