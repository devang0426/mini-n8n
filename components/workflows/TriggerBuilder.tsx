'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface TriggerItem {
  id: string;
  trigger_type: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  isNew?: boolean;
}

export interface TriggerBuilderProps {
  triggers: TriggerItem[];
  onChange: (updatedTriggers: TriggerItem[]) => void;
  canEdit: boolean;
  isOwner: boolean;
  workflowId?: string;
}

export function TriggerBuilder({ triggers, onChange, canEdit, isOwner, workflowId }: TriggerBuilderProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>('manual');
  const [cronExpr, setCronExpr] = useState<string>('0 * * * *');
  const [dbTable, setDbTable] = useState<string>('audit_logs');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Webhook Test & UI States
  const [testingTriggerId, setTestingTriggerId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<
      string,
      {
        success: boolean;
        httpStatus: number;
        statusText: string;
        runId?: string;
        errorCode?: string;
        message?: string;
      }
    >
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [webhookSecrets, setWebhookSecrets] = useState<Record<string, string>>({});

  const handleAddTrigger = () => {
    if (selectedType === 'webhook' && !isOwner) {
      alert('Only Organization Owners can configure Webhook triggers.');
      return;
    }

    let config: Record<string, unknown> = {};
    if (selectedType === 'scheduled') {
      config = { cron: cronExpr.trim() || '0 * * * *' };
    } else if (selectedType === 'database_event') {
      config = { table: dbTable.trim() || 'audit_logs', events: ['insert'] };
    } else if (selectedType === 'webhook') {
      config = { endpoint: '/api/webhooks/trigger' };
    }

    const newTrigger: TriggerItem = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      trigger_type: selectedType,
      config,
      is_enabled: true,
      isNew: true,
    };

    onChange([...triggers, newTrigger]);
    setIsAdding(false);
  };

  const handleToggleTrigger = (index: number) => {
    const next = [...triggers];
    next[index] = { ...next[index], is_enabled: !next[index].is_enabled };
    onChange(next);
  };

  const handleDeleteTrigger = (index: number) => {
    const next = triggers.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleCopyEndpoint = (triggerId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(triggerId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTestWebhook = async (trig: TriggerItem) => {
    if (!trig.id || trig.id.startsWith('temp-')) {
      alert('Please save the workflow first to persist the webhook trigger before testing.');
      return;
    }

    setTestingTriggerId(trig.id);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const endpoint = `${origin}/api/webhooks/${trig.id}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const secret =
      webhookSecrets[trig.id] !== undefined
        ? webhookSecrets[trig.id]
        : (trig.config?.secret as string) || (trig.config?.webhook_secret as string) || '933711c11c9b22f1537204d5bd536a5a957cb37cb24d320c6f755a5a07ed485c';

    if (secret && secret.trim()) {
      headers['x-webhook-secret'] = secret.trim();
    }

    const payload = {
      source: 'workflow-builder-demo',
      message: 'Test webhook execution',
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setTestResults((prev) => ({
          ...prev,
          [trig.id]: {
            success: true,
            httpStatus: res.status,
            statusText: res.statusText || 'OK',
            runId: json.workflow_run_id,
            message: 'Webhook triggered successfully.',
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [trig.id]: {
            success: false,
            httpStatus: res.status,
            statusText: res.statusText || 'Error',
            errorCode: json.code || 'WEBHOOK_ERROR',
            message: json.error || 'Webhook processing failed.',
          },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [trig.id]: {
          success: false,
          httpStatus: 0,
          statusText: 'Network Error',
          message: err.message || 'Failed to connect to webhook endpoint.',
        },
      }));
    } finally {
      setTestingTriggerId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-[#111]">Workflow Triggers</h2>
          <p className="text-xs font-bold uppercase tracking-wider text-[#555]">
            Invocation sources (manual, scheduled, database event, webhook)
          </p>
        </div>

        {canEdit && !isAdding && (
          <button
            id="add-trigger-btn"
            type="button"
            onClick={() => setIsAdding(true)}
            className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1"
          >
            <span>+ Add Trigger</span>
          </button>
        )}
      </div>

      {/* Add Trigger Panel */}
      {isAdding && canEdit && (
        <div className="p-4 rounded-xl bg-[#FFF5CC] border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] space-y-4">
          <div className="flex items-center justify-between border-b-[2px] border-[#111] pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#111]">Add Trigger Configuration</h4>
            <button onClick={() => setIsAdding(false)} className="text-xs font-black uppercase text-[#111] hover:underline">
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                Trigger Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black uppercase"
              >
                <option value="manual">Manual Trigger</option>
                <option value="scheduled">Scheduled (Cron)</option>
                <option value="database_event">Database Event</option>
                {isOwner && <option value="webhook">Webhook (Owner only)</option>}
              </select>
            </div>

            {selectedType === 'scheduled' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Cron Schedule Expression
                </label>
                <input
                  type="text"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  placeholder="0 * * * *"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-mono font-bold"
                />
              </div>
            )}

            {selectedType === 'database_event' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Source Database Table
                </label>
                <input
                  type="text"
                  value={dbTable}
                  onChange={(e) => setDbTable(e.target.value)}
                  placeholder="audit_logs"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-bold"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t-[2px] border-[#111]">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#111] bg-white border-[2px] border-[#111] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddTrigger}
              className="px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] border-[2.5px] border-[#111] shadow-[2px_2px_0_#111] rounded-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              Confirm Trigger
            </button>
          </div>
        </div>
      )}

      {/* Triggers List */}
      {triggers.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-xl border-[2.5px] border-dashed border-[#111] shadow-[3px_3px_0_#111]">
          <p className="text-xs font-black uppercase text-[#555]">No triggers configured</p>
        </div>
      ) : (
        <div className="space-y-4">
          {triggers.map((trig, idx) => {
            const isWebhook = trig.trigger_type === 'webhook';
            const isTemp = trig.id.startsWith('temp-');
            const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
            const endpointUrl = `${originUrl}/api/webhooks/${trig.id}`;

            if (isWebhook) {
              return (
                <div
                  key={trig.id || `trig-${idx}`}
                  className="p-5 bg-[#EDE8FF] rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] space-y-4"
                >
                  {/* Top Row: Title, Badges & Controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border-[2px] border-[#111] bg-[#E5D4FF] text-[#5B21B6]">
                        ⚓ WEBHOOK TRIGGER
                      </span>
                      <span
                        className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border-[2px] border-[#111] ${
                          trig.is_enabled ? 'bg-[#B6F5C8] text-[#0A6630]' : 'bg-[#FFDDEA] text-[#B02050]'
                        }`}
                      >
                        Status: {trig.is_enabled ? 'Active' : 'Disabled'}
                      </span>
                      {!isTemp && (
                        <span className="text-[11px] font-mono font-bold text-[#555]">
                          ID: {trig.id}
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleToggleTrigger(idx)}
                          className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border-[2px] border-[#111] shadow-[1.5px_1.5px_0_#111] ${
                            trig.is_enabled ? 'bg-[#F0EBE2] text-[#111]' : 'bg-[#B6F5C8] text-[#0A6630]'
                          }`}
                        >
                          {trig.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrigger(idx)}
                          className="px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white bg-[#FF6B6B] border-[2px] border-[#111] shadow-[1.5px_1.5px_0_#111] rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Endpoint URL Box */}
                  {isTemp ? (
                    <div className="p-3 bg-white/80 rounded-xl border-[2px] border-[#111] text-xs font-bold text-[#8A6000]">
                      ⚠️ Save workflow changes to generate a permanent endpoint URL for testing.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                          Webhook Ingestion Endpoint URL
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={endpointUrl}
                            className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-mono font-bold text-[#111] select-all shadow-[2px_2px_0_#111]"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyEndpoint(trig.id, endpointUrl)}
                            className="px-3.5 py-2 text-xs font-black uppercase tracking-wider bg-white hover:bg-[#F5C842] rounded-lg border-[2px] border-[#111] shadow-[2px_2px_0_#111] whitespace-nowrap active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                          >
                            {copiedId === trig.id ? '✓ Copied!' : '📋 Copy Endpoint'}
                          </button>
                        </div>
                      </div>

                      {/* Header & Test Trigger Controls */}
                      <div className="p-3.5 bg-white rounded-xl border-[2px] border-[#111] shadow-[3px_3px_0_#111] space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-black uppercase tracking-wider text-[#555] mb-1">
                              Optional Header <code className="font-mono text-[#111]">x-webhook-secret</code>
                            </label>
                            <input
                              type="password"
                              placeholder="x-webhook-secret header"
                              value={
                                webhookSecrets[trig.id] !== undefined
                                  ? webhookSecrets[trig.id]
                                  : (trig.config?.secret as string) || (trig.config?.webhook_secret as string) || '933711c11c9b22f1537204d5bd536a5a957cb37cb24d320c6f755a5a07ed485c'
                              }
                              onChange={(e) =>
                                setWebhookSecrets({ ...webhookSecrets, [trig.id]: e.target.value })
                              }
                              className="w-full px-3 py-1.5 rounded-lg border-[1.5px] border-[#111] text-xs font-mono text-[#111]"
                            />
                          </div>

                          <div>
                            <button
                              id={`test-webhook-btn-${trig.id}`}
                              type="button"
                              disabled={testingTriggerId === trig.id || !trig.is_enabled}
                              onClick={() => handleTestWebhook(trig)}
                              className="w-full px-4 py-2 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 rounded-lg border-[2.5px] border-[#111] shadow-[2px_2px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                            >
                              <span>
                                {testingTriggerId === trig.id ? 'Triggering...' : '⚡ Test Webhook'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Test Execution Result Banner */}
                        {testResults[trig.id] && (
                          <div
                            className={`p-3.5 rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] text-xs space-y-2 ${
                              testResults[trig.id].success
                                ? 'bg-[#B6F5C8] text-[#0A6630]'
                                : 'bg-[#FFDDEA] text-[#B02050]'
                            }`}
                          >
                            <div className="flex items-center justify-between font-black uppercase">
                              <span>
                                {testResults[trig.id].success
                                  ? `✅ Webhook Triggered Successfully (HTTP ${testResults[trig.id].httpStatus} ${testResults[trig.id].statusText})`
                                  : `❌ Webhook Request Failed (HTTP ${testResults[trig.id].httpStatus} ${testResults[trig.id].statusText})`}
                              </span>
                              <span className="font-mono text-[10px]">{new Date().toLocaleTimeString()}</span>
                            </div>

                            {testResults[trig.id].success && testResults[trig.id].runId && (
                              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#111]/20">
                                <span className="font-mono font-bold text-[#111]">
                                  Run ID: {testResults[trig.id].runId}
                                </span>
                                {workflowId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      router.push(
                                        `/dashboard/workflows/${workflowId}/runs/${testResults[trig.id].runId}`
                                      )
                                    }
                                    className="px-3 py-1 text-xs font-black uppercase text-[#111] bg-white hover:bg-[#F5C842] rounded-lg border-[1.5px] border-[#111] shadow-[1.5px_1.5px_0_#111] cursor-pointer"
                                  >
                                    👁️ View Live Run Execution →
                                  </button>
                                )}
                              </div>
                            )}

                            {!testResults[trig.id].success && (
                              <div className="font-mono font-bold">
                                [{testResults[trig.id].errorCode}] {testResults[trig.id].message}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Standard Non-Webhook Trigger Item
            return (
              <div
                key={trig.id || `trig-${idx}`}
                className="p-3.5 bg-white rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] flex items-center justify-between gap-4"
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border-[2px] border-[#111] ${
                      trig.is_enabled
                        ? 'bg-[#B6F5C8] text-[#0A6630]'
                        : 'bg-[#F0EBE2] text-[#555]'
                    }`}
                  >
                    {trig.trigger_type.toUpperCase()}
                  </span>

                  <span className="text-xs text-[#111] font-mono font-bold">
                    {trig.trigger_type === 'scheduled'
                      ? `Cron: ${trig.config?.cron || '0 * * * *'}`
                      : trig.trigger_type === 'database_event'
                      ? `Table: ${trig.config?.table || 'audit_logs'}`
                      : 'Manual Execution'}
                  </span>
                </div>

                {canEdit && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTrigger(idx)}
                      className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border-[2px] border-[#111] shadow-[1.5px_1.5px_0_#111] ${
                        trig.is_enabled
                          ? 'bg-[#F0EBE2] text-[#111]'
                          : 'bg-[#B6F5C8] text-[#0A6630]'
                      }`}
                    >
                      {trig.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTrigger(idx)}
                      className="px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white bg-[#FF6B6B] border-[2px] border-[#111] shadow-[1.5px_1.5px_0_#111] rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

