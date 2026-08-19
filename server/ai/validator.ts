/**
 * AI Workflow Assistant — Untrusted Proposal Server Validator (Phase P7)
 */

import {
  AIWorkflowProposal,
  AIStepProposal,
  AITriggerProposal,
  AllowedStepType,
  AllowedTriggerType,
  SafeConnectionInfo,
  ValidationIssue,
} from './types';

const ALLOWED_STEP_TYPES: AllowedStepType[] = [
  'llm_call',
  'http_request',
  'db_write',
  'notify',
  'conditional_branch',
  'approval_gate',
];

const ALLOWED_TRIGGER_TYPES: AllowedTriggerType[] = ['manual', 'webhook'];

const SECRET_KEYS = [
  'api_key',
  'apikey',
  'access_token',
  'token',
  'password',
  'secret',
  'admin_secret',
  'hasura_graphql_admin_secret',
  'webhook_secret',
  'credentials',
  'authorization',
  'private_key',
];

/**
 * Checks if a config object contains forbidden secret-like keys.
 */
function checkSecretKeys(obj: unknown, path = 'config'): ValidationIssue | null {
  if (!obj || typeof obj !== 'object') return null;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SECRET_KEYS.some((s) => lowerKey.includes(s))) {
      return {
        path: `${path}.${key}`,
        message: `Forbidden secret key '${key}' detected in configuration. Credential embedding is prohibited.`,
        code: 'SECRET_INJECTION_FORBIDDEN',
      };
    }
    if (typeof value === 'object' && value !== null) {
      const nestedIssue = checkSecretKeys(value, `${path}.${key}`);
      if (nestedIssue) return nestedIssue;
    }
  }
  return null;
}

/**
 * SSRF Hostname Validation (Reuses standard SSRF check).
 */
export function validateUrlSsrf(rawUrl: string): ValidationIssue | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      path: 'http_request.url',
      message: `Invalid URL format '${rawUrl}'.`,
      code: 'INVALID_URL_FORMAT',
    };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      path: 'http_request.url',
      message: `URL protocol '${parsedUrl.protocol}' is forbidden. Only HTTP and HTTPS are allowed.`,
      code: 'FORBIDDEN_URL_PROTOCOL',
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '169.254.169.254' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    return {
      path: 'http_request.url',
      message: `Access to private/local address '${hostname}' is denied due to SSRF protection.`,
      code: 'SSRF_PROTECTION_TRIGGERED',
    };
  }

  return null;
}

export interface ValidateProposalParams {
  rawProposal: unknown;
  userRole: 'owner' | 'editor' | 'viewer';
  availableConnections: SafeConnectionInfo[];
}

export interface ValidationResult {
  isValid: boolean;
  proposal?: AIWorkflowProposal;
  issues: ValidationIssue[];
}

export function validateAIProposal({
  rawProposal,
  userRole,
  availableConnections,
}: ValidateProposalParams): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Role Gate: Viewer role is denied at API level, but checked here as defense-in-depth
  if (userRole === 'viewer') {
    return {
      isValid: false,
      issues: [
        {
          path: 'role',
          message: 'Viewer role is not authorized to generate workflow proposals.',
          code: 'ROLE_NOT_PERMITTED',
        },
      ],
    };
  }

  if (!rawProposal || typeof rawProposal !== 'object') {
    return {
      isValid: false,
      issues: [
        {
          path: 'root',
          message: 'AI response is not a valid JSON object.',
          code: 'MALFORMED_JSON_STRUCTURE',
        },
      ],
    };
  }

  const proposalObj = rawProposal as Record<string, unknown>;

  // 1. Workflow Name Validation
  const name = typeof proposalObj.name === 'string' ? proposalObj.name.trim() : '';
  if (!name) {
    issues.push({
      path: 'name',
      message: 'Workflow name is required and cannot be empty.',
      code: 'MISSING_WORKFLOW_NAME',
    });
  } else if (name.length > 100) {
    issues.push({
      path: 'name',
      message: 'Workflow name must be 100 characters or fewer.',
      code: 'WORKFLOW_NAME_TOO_LONG',
    });
  }

  // 2. Workflow Description Validation
  let description: string | null = null;
  if (typeof proposalObj.description === 'string') {
    description = proposalObj.description.trim();
    if (description.length > 500) {
      issues.push({
        path: 'description',
        message: 'Workflow description must be 500 characters or fewer.',
        code: 'DESCRIPTION_TOO_LONG',
      });
    }
  }

  // 3. Triggers Array Validation
  const rawTriggers = Array.isArray(proposalObj.triggers) ? proposalObj.triggers : [];
  if (rawTriggers.length === 0) {
    issues.push({
      path: 'triggers',
      message: 'Workflow proposal must include at least 1 trigger.',
      code: 'MISSING_TRIGGERS',
    });
  } else if (rawTriggers.length > 5) {
    issues.push({
      path: 'triggers',
      message: 'Workflow proposal cannot exceed 5 triggers.',
      code: 'TOO_MANY_TRIGGERS',
    });
  }

  const validatedTriggers: AITriggerProposal[] = [];

  for (let i = 0; i < rawTriggers.length; i++) {
    const t = rawTriggers[i];
    const triggerPath = `triggers[${i}]`;

    if (!t || typeof t !== 'object') {
      issues.push({
        path: triggerPath,
        message: 'Trigger element must be an object.',
        code: 'INVALID_TRIGGER_ELEMENT',
      });
      continue;
    }

    const tObj = t as Record<string, unknown>;
    const triggerType = tObj.trigger_type as AllowedTriggerType;

    if (!ALLOWED_TRIGGER_TYPES.includes(triggerType)) {
      issues.push({
        path: `${triggerPath}.trigger_type`,
        message: `Trigger type '${triggerType}' is not supported. Allowed: ${ALLOWED_TRIGGER_TYPES.join(', ')}.`,
        code: 'UNSUPPORTED_TRIGGER_TYPE',
      });
      continue;
    }

    // Role Restriction: Webhook triggers require Owner role
    if (triggerType === 'webhook' && userRole !== 'owner') {
      issues.push({
        path: `${triggerPath}.trigger_type`,
        message: 'Webhook triggers can only be configured by Organization Owners.',
        code: 'ROLE_TRIGGER_RESTRICTION',
      });
    }

    const tConfig = (tObj.config || {}) as Record<string, unknown>;

    // Secret injection check for triggers
    const secretIssue = checkSecretKeys(tConfig, `${triggerPath}.config`);
    if (secretIssue) issues.push(secretIssue);

    validatedTriggers.push({
      trigger_type: triggerType,
      config: triggerType === 'webhook' ? { endpoint: '/api/webhooks/trigger', ...tConfig } : tConfig,
      is_enabled: tObj.is_enabled !== false,
    });
  }

  // 4. Steps Array Validation
  const rawSteps = Array.isArray(proposalObj.steps) ? proposalObj.steps : [];
  if (rawSteps.length === 0) {
    issues.push({
      path: 'steps',
      message: 'Workflow proposal must include at least 1 step.',
      code: 'MISSING_STEPS',
    });
  } else if (rawSteps.length > 20) {
    issues.push({
      path: 'steps',
      message: 'Workflow proposal cannot exceed 20 steps.',
      code: 'TOO_MANY_STEPS',
    });
  }

  const validatedSteps: AIStepProposal[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const step = rawSteps[i];
    const stepPath = `steps[${i}]`;

    if (!step || typeof step !== 'object') {
      issues.push({
        path: stepPath,
        message: 'Step element must be an object.',
        code: 'INVALID_STEP_ELEMENT',
      });
      continue;
    }

    const sObj = step as Record<string, unknown>;
    const stepType = sObj.step_type as AllowedStepType;

    if (!ALLOWED_STEP_TYPES.includes(stepType)) {
      issues.push({
        path: `${stepPath}.step_type`,
        message: `Step type '${stepType}' is forbidden or unsupported. Allowed: ${ALLOWED_STEP_TYPES.join(', ')}.`,
        code: 'UNSUPPORTED_STEP_TYPE',
      });
      continue;
    }

    // Role Restrictions: Editors cannot create db_write or notify steps
    if ((stepType === 'db_write' || stepType === 'notify') && userRole !== 'owner') {
      issues.push({
        path: `${stepPath}.step_type`,
        message: `Step type '${stepType}' can only be configured by Organization Owners. Editors are restricted.`,
        code: 'ROLE_STEP_RESTRICTION',
      });
    }

    const stepConfig = (sObj.config || {}) as Record<string, unknown>;

    // Secret Injection Check
    const secretIssue = checkSecretKeys(stepConfig, `${stepPath}.config`);
    if (secretIssue) issues.push(secretIssue);

    // Step-Specific Config Validation & Sanitization
    const sanitizedConfig: Record<string, unknown> = { ...stepConfig };

    if (stepType === 'llm_call') {
      if (!sanitizedConfig.prompt || typeof sanitizedConfig.prompt !== 'string' || !(sanitizedConfig.prompt as string).trim()) {
        issues.push({
          path: `${stepPath}.config.prompt`,
          message: 'LLM call step requires a non-empty prompt.',
          code: 'MISSING_LLM_PROMPT',
        });
      }
      sanitizedConfig.model = sanitizedConfig.model || 'gpt-4o';
      sanitizedConfig.temperature = typeof sanitizedConfig.temperature === 'number' ? sanitizedConfig.temperature : 0.7;
    } else if (stepType === 'http_request') {
      if (!sanitizedConfig.url || typeof sanitizedConfig.url !== 'string') {
        issues.push({
          path: `${stepPath}.config.url`,
          message: 'HTTP request step requires a valid url in config.',
          code: 'MISSING_HTTP_URL',
        });
      } else {
        const ssrfIssue = validateUrlSsrf(sanitizedConfig.url as string);
        if (ssrfIssue) {
          issues.push({ ...ssrfIssue, path: `${stepPath}.config.url` });
        }
      }
      sanitizedConfig.method = (sanitizedConfig.method || 'GET').toString().toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(sanitizedConfig.method as string)) {
        sanitizedConfig.method = 'GET';
      }
    } else if (stepType === 'db_write') {
      if (sanitizedConfig.table !== 'audit_logs' && sanitizedConfig.table !== 'notifications') {
        issues.push({
          path: `${stepPath}.config.table`,
          message: `db_write table '${sanitizedConfig.table}' is forbidden. Allowed: audit_logs, notifications.`,
          code: 'FORBIDDEN_DB_TABLE',
        });
      }
      sanitizedConfig.action = 'insert';
      if (!sanitizedConfig.data || typeof sanitizedConfig.data !== 'object') {
        sanitizedConfig.data = { action: 'workflow_event' };
      }
    } else if (stepType === 'notify') {
      if (!sanitizedConfig.recipient || typeof sanitizedConfig.recipient !== 'string') {
        issues.push({
          path: `${stepPath}.config.recipient`,
          message: 'notify step requires a valid recipient.',
          code: 'MISSING_NOTIFY_RECIPIENT',
        });
      }
      if (!['in_app', 'email', 'webhook'].includes((sanitizedConfig.channel as string) || '')) {
        sanitizedConfig.channel = 'in_app';
      }
      if (!sanitizedConfig.payload || typeof sanitizedConfig.payload !== 'object') {
        sanitizedConfig.payload = { message: 'Workflow notification' };
      }
    } else if (stepType === 'conditional_branch') {
      if (!sanitizedConfig.field || typeof sanitizedConfig.field !== 'string') {
        issues.push({
          path: `${stepPath}.config.field`,
          message: 'conditional_branch step requires a field name.',
          code: 'MISSING_BRANCH_FIELD',
        });
      }
      const allowedOps = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'is_true', 'is_false'];
      if (!allowedOps.includes((sanitizedConfig.operator as string) || '')) {
        sanitizedConfig.operator = 'equals';
      }
    } else if (stepType === 'approval_gate') {
      sanitizedConfig.message = (sanitizedConfig.message as string) || 'Please review and approve this step.';
    }

    // 5. Connection Resolution & Verification (Requirement 7)
    // AI might provide: connection_id, OR connection: { name, provider }, OR connection_name
    let resolvedConnectionId: string | undefined = undefined;

    const rawConnId = (stepConfig.connection_id || stepConfig.connectionId) as string | undefined;
    const rawConnRef = (stepConfig.connection || stepConfig.connection_ref) as any;
    const rawConnName = (stepConfig.connection_name || (typeof rawConnRef === 'string' ? rawConnRef : rawConnRef?.name)) as string | undefined;
    const rawConnProvider = (typeof rawConnRef === 'object' ? rawConnRef?.provider : undefined) as string | undefined;

    if (rawConnId || rawConnName || rawConnProvider) {
      let matched: SafeConnectionInfo | undefined = undefined;

      if (rawConnId) {
        matched = availableConnections.find((c) => c.id === rawConnId);
      }
      if (!matched && rawConnName) {
        matched = availableConnections.find(
          (c) =>
            c.name.toLowerCase() === rawConnName.toLowerCase() &&
            (!rawConnProvider || c.provider.toLowerCase() === rawConnProvider.toLowerCase())
        );
      }
      if (!matched && rawConnProvider && !rawConnName) {
        matched = availableConnections.find((c) => c.provider.toLowerCase() === rawConnProvider.toLowerCase());
      }

      if (!matched) {
        const refStr = rawConnId || rawConnName || rawConnProvider || 'unspecified';
        issues.push({
          path: `${stepPath}.config.connection`,
          message: `Referenced connection '${refStr}' does not exist in active organization or cross-org access denied.`,
          code: 'CONNECTION_NOT_FOUND',
        });
      } else {
        // Compatibility check: LLM step requires llm connection, HTTP step requires http connection
        if (stepType === 'llm_call' && matched.type !== 'llm') {
          issues.push({
            path: `${stepPath}.config.connection`,
            message: `Connection '${matched.name}' of type '${matched.type}' is incompatible with step_type 'llm_call'. Required: 'llm'.`,
            code: 'INCOMPATIBLE_CONNECTION_TYPE',
          });
        } else if (stepType === 'http_request' && matched.type !== 'http') {
          issues.push({
            path: `${stepPath}.config.connection`,
            message: `Connection '${matched.name}' of type '${matched.type}' is incompatible with step_type 'http_request'. Required: 'http'.`,
            code: 'INCOMPATIBLE_CONNECTION_TYPE',
          });
        } else {
          resolvedConnectionId = matched.id;
        }
      }
    }

    // Clean up temporary connection ref objects and attach validated connection_id
    delete sanitizedConfig.connection;
    delete sanitizedConfig.connection_ref;
    delete sanitizedConfig.connection_name;
    delete sanitizedConfig.connectionId;
    if (resolvedConnectionId) {
      sanitizedConfig.connection_id = resolvedConnectionId;
    }

    const stepName =
      typeof sObj.name === 'string' && sObj.name.trim()
        ? sObj.name.trim()
        : `${stepType.toUpperCase().replace('_', ' ')} Step ${i + 1}`;

    validatedSteps.push({
      position: i + 1, // Strictly sequential 1..N
      step_type: stepType,
      name: stepName,
      config: sanitizedConfig,
    });
  }

  if (issues.length > 0) {
    return {
      isValid: false,
      issues,
    };
  }

  const finalProposal: AIWorkflowProposal = {
    name,
    description,
    is_active: false, // AI proposals are always initialized to inactive until explicit activation
    triggers: validatedTriggers,
    steps: validatedSteps,
  };

  return {
    isValid: true,
    proposal: finalProposal,
    issues: [],
  };
}
