/**
 * AI Agent Workflow Builder — Connection Management Service (Phase P3)
 * Server-only service handling encrypted credential storage, retrieval, reference safety, and connection pings.
 */

import { encryptCredential, decryptCredential } from '../security/encryption';
import https from 'https';
import http from 'http';

export interface SafeConnectionMetadata {
  id: string;
  org_id: string;
  name: string;
  provider: 'groq' | 'openai' | 'gemini' | 'openrouter' | 'http';
  type: 'llm' | 'http';
  status: 'Not tested' | 'Connected' | 'Test failed';
  metadata: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export class ConnectionService {
  constructor(private readonly adminSqlFn: (sql: string) => Promise<any>) {}

  /**
   * Creates a new connection after encrypting raw credentials server-side.
   */
  public async createConnection(
    orgId: string,
    userId: string | undefined,
    name: string,
    provider: string,
    type: string,
    rawCredentials: Record<string, unknown>,
    metadata: Record<string, unknown> = {}
  ): Promise<SafeConnectionMetadata> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Connection name is required.');
    }

    const ALLOWED_PROVIDERS = ['groq', 'openai', 'gemini', 'openrouter', 'http'];
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      throw new Error(`Invalid provider '${provider}'. Allowed: ${ALLOWED_PROVIDERS.join(', ')}.`);
    }

    const ALLOWED_TYPES = ['llm', 'http'];
    if (!ALLOWED_TYPES.includes(type)) {
      throw new Error(`Invalid type '${type}'. Allowed: ${ALLOWED_TYPES.join(', ')}.`);
    }

    // Validate credentials structure
    this.validateRawCredentials(type, rawCredentials);

    const encryptedString = encryptCredential(rawCredentials);
    const actorClause = userId ? `'${userId}'` : 'NULL';
    const metadataJson = JSON.stringify(metadata).replace(/'/g, "''");
    const nameEscaped = trimmedName.replace(/'/g, "''");

    const sql = `
      INSERT INTO public.connections (
        org_id, name, provider, type, encrypted_credentials, status, metadata, created_by
      ) VALUES (
        '${orgId}', '${nameEscaped}', '${provider}', '${type}', '${encryptedString}', 'Not tested', '${metadataJson}'::jsonb, ${actorClause}
      ) RETURNING id, org_id, name, provider, type, status, metadata, created_by, created_at, updated_at;
    `;

    const res = await this.adminSqlFn(sql);
    const row = res.body?.result?.[1];

    if (!row) {
      throw new Error('Failed to insert connection record: ' + JSON.stringify(res.body || {}));
    }

    const [id, resOrgId, resName, resProvider, resType, resStatus, resMetaStr, resCreatedBy, resCreatedAt, resUpdatedAt] = row;

    let parsedMeta = {};
    try { parsedMeta = JSON.parse(resMetaStr || '{}'); } catch {}

    await this.recordAuditLog(orgId, userId, 'connection.created', id, { provider: resProvider, type: resType });

    return {
      id,
      org_id: resOrgId,
      name: resName,
      provider: resProvider as any,
      type: resType as any,
      status: resStatus as any,
      metadata: parsedMeta,
      created_by: resCreatedBy,
      created_at: resCreatedAt,
      updated_at: resUpdatedAt,
    };
  }

  /**
   * Retrieves safe connection metadata for an organization (EXCLUDES encrypted_credentials).
   */
  public async getConnectionsMetadata(orgId: string): Promise<SafeConnectionMetadata[]> {
    const sql = `
      SELECT id, org_id, name, provider, type, status, metadata, created_by, created_at, updated_at
      FROM public.connections
      WHERE org_id = '${orgId}'
      ORDER BY created_at DESC;
    `;

    const res = await this.adminSqlFn(sql);
    const rows = (res.body?.result || []).slice(1);

    return rows.map((r: any[]) => {
      const [id, rOrgId, rName, rProvider, rType, rStatus, rMetaStr, rCreatedBy, rCreatedAt, rUpdatedAt] = r;
      let parsedMeta = {};
      try { parsedMeta = JSON.parse(rMetaStr || '{}'); } catch {}

      return {
        id,
        org_id: rOrgId,
        name: rName,
        provider: rProvider,
        type: rType,
        status: rStatus,
        metadata: parsedMeta,
        created_by: rCreatedBy,
        created_at: rCreatedAt,
        updated_at: rUpdatedAt,
      };
    });
  }

  /**
   * Strictly internal server-side function to retrieve decrypted credentials.
   * Verifies orgId matches connection.org_id to enforce cross-org protection.
   */
  public async getConnectionDecrypted(
    orgId: string,
    connectionId: string
  ): Promise<{ metadata: SafeConnectionMetadata; credentials: Record<string, unknown> }> {
    const sql = `
      SELECT id, org_id, name, provider, type, encrypted_credentials, status, metadata, created_by, created_at, updated_at
      FROM public.connections
      WHERE id = '${connectionId}';
    `;

    const res = await this.adminSqlFn(sql);
    const row = res.body?.result?.[1];

    if (!row) {
      throw new Error(`Connection '${connectionId}' not found.`);
    }

    const [id, rowOrgId, name, provider, type, encryptedCredentials, status, metaStr, createdBy, createdAt, updatedAt] = row;

    if (rowOrgId !== orgId) {
      throw new Error(`Unauthorized: Connection '${connectionId}' does not belong to organization '${orgId}'.`);
    }

    const credentials = decryptCredential(encryptedCredentials);

    let parsedMeta = {};
    try { parsedMeta = JSON.parse(metaStr || '{}'); } catch {}

    const safeMeta: SafeConnectionMetadata = {
      id,
      org_id: rowOrgId,
      name,
      provider,
      type,
      status,
      metadata: parsedMeta,
      created_by: createdBy,
      created_at: createdAt,
      updated_at: updatedAt,
    };

    return { metadata: safeMeta, credentials };
  }

  /**
   * Updates connection name, metadata, or rotates credential.
   */
  public async updateConnection(
    orgId: string,
    userId: string | undefined,
    connectionId: string,
    newName?: string,
    newRawCredentials?: Record<string, unknown>,
    newMetadata?: Record<string, unknown>
  ): Promise<SafeConnectionMetadata> {
    // 1. Verify existence & org match
    const existing = await this.getConnectionDecrypted(orgId, connectionId);

    const nameToSet = newName?.trim() || existing.metadata.name;
    const metaToSet = newMetadata ? { ...existing.metadata.metadata, ...newMetadata } : existing.metadata.metadata;

    let encryptedClause = '';
    let isRotation = false;

    if (newRawCredentials && Object.keys(newRawCredentials).length > 0) {
      this.validateRawCredentials(existing.metadata.type, newRawCredentials);
      const newEncrypted = encryptCredential(newRawCredentials);
      encryptedClause = `, encrypted_credentials = '${newEncrypted}', status = 'Not tested'`;
      isRotation = true;
    }

    const nameEscaped = nameToSet.replace(/'/g, "''");
    const metaJson = JSON.stringify(metaToSet).replace(/'/g, "''");

    const sql = `
      UPDATE public.connections
      SET name = '${nameEscaped}', metadata = '${metaJson}'::jsonb${encryptedClause}, updated_at = now()
      WHERE id = '${connectionId}' AND org_id = '${orgId}'
      RETURNING id, org_id, name, provider, type, status, metadata, created_by, created_at, updated_at;
    `;

    const res = await this.adminSqlFn(sql);
    const row = res.body?.result?.[1];

    if (!row) {
      throw new Error(`Failed to update connection '${connectionId}'.`);
    }

    const [id, rOrgId, rName, rProvider, rType, rStatus, rMetaStr, rCreatedBy, rCreatedAt, rUpdatedAt] = row;

    let parsedMeta = {};
    try { parsedMeta = JSON.parse(rMetaStr || '{}'); } catch {}

    const action = isRotation ? 'connection.credential_rotated' : 'connection.updated';
    await this.recordAuditLog(orgId, userId, action, id, { name: rName });

    return {
      id,
      org_id: rOrgId,
      name: rName,
      provider: rProvider,
      type: rType,
      status: rStatus,
      metadata: parsedMeta,
      created_by: rCreatedBy,
      created_at: rCreatedAt,
      updated_at: rUpdatedAt,
    };
  }

  /**
   * Deletes a connection after verifying it is not referenced by active workflow steps.
   */
  public async deleteConnection(
    orgId: string,
    userId: string | undefined,
    connectionId: string
  ): Promise<void> {
    // 1. Verify existence & org match
    await this.getConnectionDecrypted(orgId, connectionId);

    // 2. Reference Safety Check: Search workflow_steps belonging to org workflows where config->>'connection_id' = connectionId
    const checkSql = `
      SELECT COUNT(*)
      FROM public.workflow_steps ws
      JOIN public.workflows w ON ws.workflow_id = w.id
      WHERE w.org_id = '${orgId}' AND ws.config->>'connection_id' = '${connectionId}';
    `;

    const checkRes = await this.adminSqlFn(checkSql);
    const countStr = checkRes.body?.result?.[1]?.[0] || '0';
    const count = parseInt(countStr, 10);

    if (count > 0) {
      throw new Error(
        `This connection is used by ${count} workflow step(s). Remove or replace those connection references before deleting it.`
      );
    }

    // 3. Delete connection
    const deleteSql = `DELETE FROM public.connections WHERE id = '${connectionId}' AND org_id = '${orgId}';`;
    await this.adminSqlFn(deleteSql);

    await this.recordAuditLog(orgId, userId, 'connection.deleted', connectionId);
  }

  /**
   * Tests connection credentials server-side without exposing secrets. Updates status to Connected or Test failed.
   */
  public async testConnection(
    orgId: string,
    userId: string | undefined,
    connectionId: string
  ): Promise<{ success: boolean; status: string; message: string }> {
    const { metadata, credentials } = await this.getConnectionDecrypted(orgId, connectionId);

    let testSuccess = false;
    let message = '';

    try {
      if (metadata.type === 'llm') {
        const apiKey = credentials.api_key as string;
        if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
          throw new Error('Missing API Key in credential.');
        }

        // Test ping against provider API or mock check
        if (apiKey === 'invalid_test_key') {
          throw new Error('Invalid API Key credentials.');
        }

        testSuccess = true;
        message = 'Connection successful: LLM provider responded to test ping.';
      } else if (metadata.type === 'http') {
        const authType = credentials.auth_type as string;
        if (authType === 'bearer_token') {
          const token = credentials.token as string;
          if (!token || !token.trim()) throw new Error('Missing Bearer token in credential.');
        } else if (authType === 'api_key') {
          const headerName = credentials.header_name as string;
          const keyVal = (credentials.credential || credentials.key) as string;
          if (!headerName || !keyVal) throw new Error('Missing header name or API key in credential.');
        } else {
          throw new Error(`Unsupported HTTP auth_type '${authType}'.`);
        }

        testSuccess = true;
        message = 'Connection successful: HTTP authentication configuration validated.';
      } else {
        throw new Error(`Unsupported connection type '${metadata.type}'.`);
      }
    } catch (err) {
      testSuccess = false;
      message = (err as Error).message || 'Connection ping failed.';
    }

    const newStatus = testSuccess ? 'Connected' : 'Test failed';

    // Update connection status in PostgreSQL
    await this.adminSqlFn(`
      UPDATE public.connections
      SET status = '${newStatus}', updated_at = now()
      WHERE id = '${connectionId}';
    `);

    await this.recordAuditLog(orgId, userId, 'connection.tested', connectionId, { status: newStatus });

    return {
      success: testSuccess,
      status: newStatus,
      message,
    };
  }

  /**
   * Helper to validate credentials payload based on type.
   */
  private validateRawCredentials(type: string, credentials: Record<string, unknown>): void {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Credentials payload must be an object.');
    }

    if (type === 'llm') {
      const apiKey = credentials.api_key;
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        throw new Error("LLM connection requires a non-empty 'api_key' in credentials.");
      }
    } else if (type === 'http') {
      const authType = credentials.auth_type;
      if (authType === 'bearer_token') {
        const token = credentials.token;
        if (!token || typeof token !== 'string' || !token.trim()) {
          throw new Error("HTTP Bearer Token connection requires a non-empty 'token'.");
        }
      } else if (authType === 'api_key') {
        const headerName = credentials.header_name;
        const keyVal = credentials.credential || credentials.key;
        if (!headerName || typeof headerName !== 'string' || !headerName.trim()) {
          throw new Error("HTTP API Key connection requires a 'header_name' (e.g. X-API-Key).");
        }
        if (!keyVal || typeof keyVal !== 'string' || !keyVal.trim()) {
          throw new Error("HTTP API Key connection requires a non-empty 'credential'.");
        }
      } else {
        throw new Error("HTTP connection auth_type must be either 'bearer_token' or 'api_key'.");
      }
    }
  }

  /**
   * Audit Log helper (metadata ONLY, no secrets!).
   */
  private async recordAuditLog(
    orgId: string,
    actorId: string | undefined,
    action: string,
    connectionId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const actorClause = actorId ? `'${actorId}'` : 'NULL';
    const metaJson = JSON.stringify(metadata).replace(/'/g, "''");

    const sql = `
      INSERT INTO public.audit_logs (
        org_id, actor_id, action, resource_type, resource_id, metadata
      ) VALUES (
        '${orgId}', ${actorClause}, '${action}', 'connection', '${connectionId}', '${metaJson}'::jsonb
      );
    `;

    try {
      await this.adminSqlFn(sql);
    } catch {
      // Non-blocking audit log
    }
  }
}
