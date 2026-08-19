'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAccessToken } from '@nhost/react';
import { useOrganization } from '@/hooks/useOrganization';

export interface SafeConnection {
  id: string;
  org_id: string;
  name: string;
  provider: 'groq' | 'openai' | 'gemini' | 'openrouter' | 'http';
  type: 'llm' | 'http';
  status: 'Not tested' | 'Connected' | 'Test failed';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export default function ConnectionsPage() {
  const accessToken = useAccessToken();
  const { organization, role, isViewer, canEditWorkflow } = useOrganization();

  const [connections, setConnections] = useState<SafeConnection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingConn, setEditingConn] = useState<SafeConnection | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<'groq' | 'openai' | 'gemini' | 'openrouter' | 'http'>('groq');
  const [type, setType] = useState<'llm' | 'http'>('llm');

  // Credential Inputs (Masked)
  const [apiKey, setApiKey] = useState('');
  const [httpAuthType, setHttpAuthType] = useState<'bearer_token' | 'api_key'>('bearer_token');
  const [httpHeaderName, setHttpHeaderName] = useState('X-API-Key');
  const [httpCredential, setHttpCredential] = useState('');
  const [rotateCredential, setRotateCredential] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!organization?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/connections?org_id=${organization.id}`, {
        headers: { 'x-user-id': accessToken || '' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch connections.');
      }
      setConnections(data.connections || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, accessToken]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleOpenAddModal = () => {
    setEditingConn(null);
    setName('');
    setProvider('groq');
    setType('llm');
    setApiKey('');
    setHttpAuthType('bearer_token');
    setHttpHeaderName('X-API-Key');
    setHttpCredential('');
    setRotateCredential(false);
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (conn: SafeConnection) => {
    setEditingConn(conn);
    setName(conn.name);
    setProvider(conn.provider);
    setType(conn.type);
    setApiKey('');
    setHttpAuthType('bearer_token');
    setHttpHeaderName('X-API-Key');
    setHttpCredential('');
    setRotateCredential(false);
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || isSubmitting) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      let credentials: Record<string, unknown> | undefined = undefined;

      if (!editingConn || rotateCredential) {
        if (type === 'llm') {
          if (!apiKey.trim()) throw new Error('API Key is required.');
          credentials = { api_key: apiKey.trim() };
        } else {
          if (httpAuthType === 'bearer_token') {
            if (!httpCredential.trim()) throw new Error('Bearer Token credential is required.');
            credentials = { auth_type: 'bearer_token', token: httpCredential.trim() };
          } else {
            if (!httpHeaderName.trim()) throw new Error('Header Name is required (e.g. X-API-Key).');
            if (!httpCredential.trim()) throw new Error('API Key credential is required.');
            credentials = { auth_type: 'api_key', header_name: httpHeaderName.trim(), credential: httpCredential.trim() };
          }
        }
      }

      if (editingConn) {
        const res = await fetch(`/api/connections/${editingConn.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': accessToken || '' },
          body: JSON.stringify({
            org_id: organization.id,
            name: name.trim(),
            credentials,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update connection.');
      } else {
        const res = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': accessToken || '' },
          body: JSON.stringify({
            org_id: organization.id,
            name: name.trim(),
            provider,
            type,
            credentials,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create connection.');
      }

      setIsAddModalOpen(false);
      await fetchConnections();
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async (connId: string) => {
    if (!organization?.id || testingId) return;

    setTestingId(connId);
    setTestResult(null);

    try {
      const res = await fetch(`/api/connections/${connId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': accessToken || '' },
        body: JSON.stringify({ org_id: organization.id }),
      });
      const data = await res.json();
      setTestResult({ id: connId, success: data.success, message: data.message || data.error });
      await fetchConnections();
    } catch (err) {
      setTestResult({ id: connId, success: false, message: (err as Error).message || 'Test failed.' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConnection = async (conn: SafeConnection) => {
    if (!organization?.id || isViewer) return;

    const confirmed = window.confirm(`Are you sure you want to delete connection "${conn.name}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/connections/${conn.id}?org_id=${organization.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': accessToken || '' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete connection.');
      await fetchConnections();
    } catch (err) {
      alert((err as Error).message || 'Failed to delete connection.');
    }
  };

  const STATUS_STYLES: Record<string, string> = {
    'Connected': 'bg-[#00C8B4] text-[#111] border-[#111]',
    'Test failed': 'bg-[#FF6B6B] text-white border-[#111]',
    'Not tested': 'bg-[#F5C842] text-[#111] border-[#111]',
  };

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#111]">
            Organization Connections & Credentials
          </h1>
          <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
            AES-256-GCM encrypted server-side connection credentials for {organization?.name}
          </p>
        </div>

        {canEditWorkflow && (
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#F5C842] hover:bg-[#E5B832] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-2"
          >
            <span>🔑</span>
            <span>+ Add Connection</span>
          </button>
        )}
      </div>

      {/* Test Result Feedback Banner */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] text-xs font-bold uppercase tracking-wider ${
            testResult.success ? 'bg-[#00C8B4] text-[#111]' : 'bg-[#FF6B6B] text-white'
          }`}
        >
          <div className="font-black">
            {testResult.success ? '✓ Connection Successful' : '✕ Connection Failed'}
          </div>
          <p className="mt-1">{testResult.message}</p>
        </div>
      )}

      {/* Main Connections List */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111] space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-xs font-black uppercase tracking-wider">
            Fetching organization connections...
          </div>
        ) : connections.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="text-4xl">🔐</div>
            <h3 className="text-xl font-black uppercase tracking-wider">No Connections Configured</h3>
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider max-w-md mx-auto">
              Configure reusable encrypted credentials for LLM and HTTP API steps in {organization?.name}.
            </p>
            {canEditWorkflow && (
              <button
                onClick={handleOpenAddModal}
                className="mt-2 px-5 py-2.5 bg-[#F5C842] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#E5B832] transition-all cursor-pointer"
              >
                Add First Connection
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="p-5 bg-white border-[2.5px] border-[#111] rounded-[18px] shadow-[4px_4px_0_#111] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-black">{conn.type === 'llm' ? '🤖' : '🌐'}</span>
                      <h3 className="font-black text-base uppercase tracking-wider text-[#111]">
                        {conn.name}
                      </h3>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border-[1.5px] ${
                        STATUS_STYLES[conn.status] || STATUS_STYLES['Not tested']
                      }`}
                    >
                      {conn.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-bold text-[#555] uppercase mt-1">
                    <span>Provider: <strong className="text-[#111]">{conn.provider}</strong></span>
                    <span>•</span>
                    <span>Type: <strong className="text-[#111]">{conn.type}</strong></span>
                  </div>

                  <div className="bg-[#F5EFE6] p-2.5 rounded-xl border-[1.5px] border-[#111] text-[11px] font-mono text-[#555] mt-3">
                    Credential: <span className="font-bold text-[#111]">••••••••••••</span> (AES-256-GCM Encrypted)
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t-[1.5px] border-[#111] flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#888]">
                    Created {new Date(conn.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center space-x-2">
                    {!isViewer && (
                      <button
                        onClick={() => handleTestConnection(conn.id)}
                        disabled={testingId === conn.id}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-[#F5C842] text-[#111] rounded-lg border-[1.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#E5B832] disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {testingId === conn.id ? 'Testing...' : 'Test'}
                      </button>
                    )}

                    {canEditWorkflow && (
                      <button
                        onClick={() => handleOpenEditModal(conn)}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-white text-[#111] rounded-lg border-[1.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5EFE6] transition-all cursor-pointer"
                      >
                        Edit
                      </button>
                    )}

                    {canEditWorkflow && (
                      <button
                        onClick={() => handleDeleteConnection(conn)}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-white text-[#FF6B6B] rounded-lg border-[1.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#FF6B6B] hover:text-white transition-all cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Connection Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5EFE6]/85 backdrop-none">
          <div className="w-full max-w-lg bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5">
            <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
              <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">
                {editingConn ? 'Edit Connection' : 'Add New Connection'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] flex items-center justify-center font-black text-sm transition-all"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] text-xs font-bold text-white uppercase tracking-wider">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveConnection} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                  Connection Name <span className="text-[#FF6B6B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Groq AI Key"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
                />
              </div>

              {!editingConn && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                      Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => {
                        const t = e.target.value as 'llm' | 'http';
                        setType(t);
                        setProvider(t === 'llm' ? 'groq' : 'http');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-xs font-black uppercase text-[#111] shadow-[3px_3px_0_#111] focus:outline-none cursor-pointer"
                    >
                      <option value="llm">LLM Provider</option>
                      <option value="http">HTTP API</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-xs font-black uppercase text-[#111] shadow-[3px_3px_0_#111] focus:outline-none cursor-pointer"
                    >
                      {type === 'llm' ? (
                        <>
                          <option value="groq">Groq</option>
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Gemini</option>
                          <option value="openrouter">OpenRouter</option>
                        </>
                      ) : (
                        <option value="http">Generic HTTP</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Credential Inputs */}
              {editingConn && (
                <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-[#F5EFE6] border-[2px] border-[#111]">
                  <input
                    type="checkbox"
                    id="rotate-cred-checkbox"
                    checked={rotateCredential}
                    onChange={(e) => setRotateCredential(e.target.checked)}
                    className="h-4 w-4 border-[2px] border-[#111] accent-[#F5C842] cursor-pointer"
                  />
                  <label htmlFor="rotate-cred-checkbox" className="text-xs font-black uppercase text-[#111] cursor-pointer">
                    Replace / Rotate Existing Credential
                  </label>
                </div>
              )}

              {(!editingConn || rotateCredential) && (
                <div className="space-y-3 pt-1">
                  {type === 'llm' ? (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                        API Key Credential <span className="text-[#FF6B6B]">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="••••••••••••••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all font-mono"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                          HTTP Authentication Type
                        </label>
                        <select
                          value={httpAuthType}
                          onChange={(e) => setHttpAuthType(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-xs font-black uppercase text-[#111] shadow-[3px_3px_0_#111] focus:outline-none cursor-pointer"
                        >
                          <option value="bearer_token">Bearer Token</option>
                          <option value="api_key">API Key Header</option>
                        </select>
                      </div>

                      {httpAuthType === 'api_key' && (
                        <div>
                          <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                            Header Name (e.g. X-API-Key)
                          </label>
                          <input
                            type="text"
                            required
                            value={httpHeaderName}
                            onChange={(e) => setHttpHeaderName(e.target.value)}
                            placeholder="X-API-Key"
                            className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:outline-none transition-all"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                          {httpAuthType === 'bearer_token' ? 'Bearer Token' : 'API Key Secret'} <span className="text-[#FF6B6B]">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={httpCredential}
                          onChange={(e) => setHttpCredential(e.target.value)}
                          placeholder="••••••••••••••••••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all font-mono"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t-[2.5px] border-[#111]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#F0EBE2] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingConn ? 'Save Changes' : 'Create Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
