import React, { useState, useEffect, useCallback } from 'react';
import { useAccessToken } from '@nhost/react';
import { useOrganization } from '@/hooks/useOrganization';

export interface StepConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stepType: string, config: Record<string, unknown>) => void;
  initialStepType?: string;
  initialConfig?: Record<string, unknown>;
  isOwner: boolean;
}

export function StepConfigModal({
  isOpen,
  onClose,
  onSave,
  initialStepType = 'llm_call',
  initialConfig = {},
  isOwner,
}: StepConfigModalProps) {
  const accessToken = useAccessToken();
  const { organization } = useOrganization();
  const [stepType, setStepType] = useState<string>(initialStepType);

  // Connections List
  const [orgConnections, setOrgConnections] = useState<Array<{ id: string; name: string; provider: string; type: string }>>([]);
  const [connectionId, setConnectionId] = useState<string>('');

  // Form State
  const [llmModel, setLlmModel] = useState<string>('gpt-4o');
  const [llmPrompt, setLlmPrompt] = useState<string>('Analyze the input payload.');
  const [llmTemperature, setLlmTemperature] = useState<number>(0.7);

  const [httpUrl, setHttpUrl] = useState<string>('https://httpbin.org/get');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [httpHeadersStr, setHttpHeadersStr] = useState<string>('{}');
  const [httpBodyStr, setHttpBodyStr] = useState<string>('{}');

  const [dbTable, setDbTable] = useState<'audit_logs' | 'notifications'>('audit_logs');
  const [dbDataStr, setDbDataStr] = useState<string>('{"action":"workflow_event"}');

  const [notifyRecipient, setNotifyRecipient] = useState<string>('admin@example.com');
  const [notifyChannel, setNotifyChannel] = useState<'in_app' | 'email' | 'webhook'>('in_app');
  const [notifyPayloadStr, setNotifyPayloadStr] = useState<string>('{"message":"Workflow notification"}');

  const [branchField, setBranchField] = useState<string>('status');
  const [branchOperator, setBranchOperator] = useState<
    'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_true' | 'is_false'
  >('equals');
  const [branchValue, setBranchValue] = useState<string>('completed');

  const [approvalMessage, setApprovalMessage] = useState<string>('Please review and approve this step.');

  // Browser Automation State
  const [browserUrl, setBrowserUrl] = useState<string>('https://example.com');
  const [browserUserAgent, setBrowserUserAgent] = useState<string>('Mozilla/5.0 Stagehand/1.0 AI-Agent-Browser');

  const [actAction, setActAction] = useState<string>('Click search button and submit query');
  const [actSelector, setActSelector] = useState<string>('button#search-btn');
  const [actValue, setActValue] = useState<string>('');

  const [extractInstruction, setExtractInstruction] = useState<string>('Extract product names, prices, and review scores');

  const [observeFilterSelector, setObserveFilterSelector] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const res = await fetch(`/api/connections?org_id=${organization.id}`, {
        headers: { 'x-user-id': accessToken || '' },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.connections)) {
        setOrgConnections(data.connections);
      }
    } catch {
      // Ignore error for connection fetch
    }
  }, [organization?.id, accessToken]);

  useEffect(() => {
    if (isOpen) {
      fetchConnections();
      setStepType(initialStepType);
      setConnectionId((initialConfig.connection_id as string) || (initialConfig.connectionId as string) || '');
      setError(null);

      if (initialStepType === 'llm_call') {
        setLlmModel((initialConfig.model as string) || 'gpt-4o');
        setLlmPrompt((initialConfig.prompt as string) || 'Analyze the input payload.');
        setLlmTemperature(typeof initialConfig.temperature === 'number' ? initialConfig.temperature : 0.7);
      } else if (initialStepType === 'http_request') {
        setHttpUrl((initialConfig.url as string) || 'https://httpbin.org/get');
        setHttpMethod((initialConfig.method as any) || 'GET');
        setHttpHeadersStr(JSON.stringify(initialConfig.headers || {}, null, 2));
        setHttpBodyStr(JSON.stringify(initialConfig.body || {}, null, 2));
      } else if (initialStepType === 'db_write') {
        setDbTable((initialConfig.table as any) || 'audit_logs');
        setDbDataStr(JSON.stringify(initialConfig.data || { action: 'workflow_event' }, null, 2));
      } else if (initialStepType === 'notify') {
        setNotifyRecipient((initialConfig.recipient as string) || 'admin@example.com');
        setNotifyChannel((initialConfig.channel as any) || 'in_app');
        setNotifyPayloadStr(JSON.stringify(initialConfig.payload || { message: 'Workflow notification' }, null, 2));
      } else if (initialStepType === 'conditional_branch') {
        setBranchField((initialConfig.field as string) || 'status');
        setBranchOperator((initialConfig.operator as any) || 'equals');
        setBranchValue(String(initialConfig.value ?? 'completed'));
      } else if (initialStepType === 'approval_gate') {
        setApprovalMessage((initialConfig.message as string) || 'Please review and approve this step.');
      } else if (initialStepType === 'browser_navigate') {
        setBrowserUrl((initialConfig.url as string) || 'https://example.com');
        setBrowserUserAgent((initialConfig.userAgent as string) || 'Mozilla/5.0 Stagehand/1.0 AI-Agent-Browser');
      } else if (initialStepType === 'stagehand_act') {
        setActAction((initialConfig.action as string) || 'Click search button and submit query');
        setActSelector((initialConfig.selector as string) || '');
        setActValue((initialConfig.value as string) || '');
      } else if (initialStepType === 'stagehand_extract') {
        setExtractInstruction((initialConfig.instruction as string) || 'Extract product names, prices, and review scores');
      } else if (initialStepType === 'stagehand_observe') {
        setObserveFilterSelector((initialConfig.filterSelector as string) || '');
      }
    }
  }, [isOpen, initialStepType, initialConfig, fetchConnections]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let config: Record<string, unknown> = {};

    try {
      if (stepType === 'llm_call') {
        config = {
          model: llmModel.trim(),
          prompt: llmPrompt.trim(),
          temperature: llmTemperature,
          connection_id: connectionId || undefined,
          simulateNotImplemented: false,
        };
      } else if (stepType === 'http_request') {
        let headersObj = {};
        let bodyObj = {};
        if (httpHeadersStr.trim()) headersObj = JSON.parse(httpHeadersStr);
        if (httpBodyStr.trim()) bodyObj = JSON.parse(httpBodyStr);

        config = {
          url: httpUrl.trim(),
          method: httpMethod,
          headers: headersObj,
          body: bodyObj,
          connection_id: connectionId || undefined,
        };
      } else if (stepType === 'db_write') {
        if (!isOwner) {
          throw new Error('db_write steps can only be configured by Organization Owners.');
        }
        let dataObj = {};
        if (dbDataStr.trim()) dataObj = JSON.parse(dbDataStr);

        config = {
          table: dbTable,
          action: 'insert',
          data: dataObj,
        };
      } else if (stepType === 'notify') {
        if (!isOwner) {
          throw new Error('notify steps can only be configured by Organization Owners.');
        }
        let payloadObj = {};
        if (notifyPayloadStr.trim()) payloadObj = JSON.parse(notifyPayloadStr);

        config = {
          recipient: notifyRecipient.trim(),
          channel: notifyChannel,
          payload: payloadObj,
        };
      } else if (stepType === 'conditional_branch') {
        let parsedVal: any = branchValue;
        if (branchValue === 'true') parsedVal = true;
        else if (branchValue === 'false') parsedVal = false;
        else if (!isNaN(Number(branchValue)) && branchValue.trim() !== '') parsedVal = Number(branchValue);

        config = {
          field: branchField.trim(),
          operator: branchOperator,
          value: parsedVal,
        };
      } else if (stepType === 'approval_gate') {
        config = {
          message: approvalMessage.trim(),
        };
      } else if (stepType === 'browser_navigate') {
        config = {
          url: browserUrl.trim(),
          userAgent: browserUserAgent.trim(),
        };
      } else if (stepType === 'stagehand_act') {
        config = {
          action: actAction.trim(),
          selector: actSelector.trim(),
          value: actValue.trim(),
        };
      } else if (stepType === 'stagehand_extract') {
        config = {
          instruction: extractInstruction.trim(),
        };
      } else if (stepType === 'stagehand_observe') {
        config = {
          filterSelector: observeFilterSelector.trim(),
        };
      }

      onSave(stepType, config);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Invalid step configuration.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5EFE6]/85 backdrop-none">
      <div className="w-full max-w-xl bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
          <h3 className="text-lg font-black uppercase tracking-wider text-[#111]">Configure Step</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] flex items-center justify-center font-black text-sm transition-all">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] text-xs font-bold text-white uppercase tracking-wider">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step Type Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
              Step Type
            </label>
            <select
              value={stepType}
              onChange={(e) => setStepType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-xs font-black uppercase tracking-wider text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none"
            >
              <option value="llm_call">LLM Call</option>
              <option value="http_request">HTTP Request</option>
              {isOwner && <option value="db_write">DB Write (Owner only)</option>}
              {isOwner && <option value="notify">Notify (Owner only)</option>}
              <option value="conditional_branch">Conditional Branch</option>
              <option value="approval_gate">Approval Gate</option>
              <option value="browser_navigate">Browser Navigate (Stagehand)</option>
              <option value="stagehand_act">Stagehand Act (AI Action)</option>
              <option value="stagehand_extract">Stagehand Extract (AI Data)</option>
              <option value="stagehand_observe">Stagehand Observe (DOM Elements)</option>
            </select>
          </div>

          {/* 1. LLM CALL FIELDS */}
          {stepType === 'llm_call' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#EDE8FF] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Secure Connection (Optional)
                </label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black uppercase text-[#111]"
                >
                  <option value="">Default / Legacy Environment Key (LLM_API_KEY)</option>
                  {orgConnections
                    .filter((c) => c.type === 'llm')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        🔑 {c.name} ({c.provider})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Prompt Template
                </label>
                <textarea
                  rows={3}
                  value={llmPrompt}
                  onChange={(e) => setLlmPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Temperature ({llmTemperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={llmTemperature}
                  onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-[#7B5CF5]"
                />
              </div>
            </div>
          )}

          {/* 2. HTTP REQUEST FIELDS */}
          {stepType === 'http_request' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#DDEEFF] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Secure HTTP Connection (Optional)
                </label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black uppercase text-[#111]"
                >
                  <option value="">None (Unauthenticated / Header-injected)</option>
                  {orgConnections
                    .filter((c) => c.type === 'http')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        🔑 {c.name} ({c.provider})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  URL
                </label>
                <input
                  type="url"
                  required
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  placeholder="https://api.example.com/data"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  HTTP Method
                </label>
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black uppercase"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Headers (JSON)
                </label>
                <textarea
                  rows={2}
                  value={httpHeadersStr}
                  onChange={(e) => setHttpHeadersStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Body (JSON)
                </label>
                <textarea
                  rows={2}
                  value={httpBodyStr}
                  onChange={(e) => setHttpBodyStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* 3. DB WRITE FIELDS */}
          {stepType === 'db_write' && isOwner && (
            <div className="space-y-3 p-4 rounded-xl bg-[#D0FAF4] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Target Table (Allowlisted)
                </label>
                <select
                  value={dbTable}
                  onChange={(e) => setDbTable(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black"
                >
                  <option value="audit_logs">audit_logs</option>
                  <option value="notifications">notifications</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Data Payload (JSON Object)
                </label>
                <textarea
                  rows={3}
                  value={dbDataStr}
                  onChange={(e) => setDbDataStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* 4. NOTIFY FIELDS */}
          {stepType === 'notify' && isOwner && (
            <div className="space-y-3 p-4 rounded-xl bg-[#FFE8CC] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Recipient
                </label>
                <input
                  type="text"
                  required
                  value={notifyRecipient}
                  onChange={(e) => setNotifyRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Channel
                </label>
                <select
                  value={notifyChannel}
                  onChange={(e) => setNotifyChannel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black uppercase"
                >
                  <option value="in_app">in_app</option>
                  <option value="email">email</option>
                  <option value="webhook">webhook</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Payload (JSON)
                </label>
                <textarea
                  rows={2}
                  value={notifyPayloadStr}
                  onChange={(e) => setNotifyPayloadStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* 5. CONDITIONAL BRANCH FIELDS */}
          {stepType === 'conditional_branch' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#FFF5CC] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Target Field Name
                </label>
                <input
                  type="text"
                  required
                  value={branchField}
                  onChange={(e) => setBranchField(e.target.value)}
                  placeholder="statusCode"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Operator
                </label>
                <select
                  value={branchOperator}
                  onChange={(e) => setBranchOperator(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-black uppercase"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not_equals</option>
                  <option value="greater_than">greater_than</option>
                  <option value="less_than">less_than</option>
                  <option value="contains">contains</option>
                  <option value="is_true">is_true</option>
                  <option value="is_false">is_false</option>
                </select>
              </div>
              {branchOperator !== 'is_true' && branchOperator !== 'is_false' && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                    Expected Value
                  </label>
                  <input
                    type="text"
                    value={branchValue}
                    onChange={(e) => setBranchValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                  />
                </div>
              )}
            </div>
          )}

          {/* 6. APPROVAL GATE FIELDS */}
          {stepType === 'approval_gate' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#FFDDEA] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Approval Message / Prompt
                </label>
                <textarea
                  rows={3}
                  required
                  value={approvalMessage}
                  onChange={(e) => setApprovalMessage(e.target.value)}
                  placeholder="Please review step execution results before proceeding..."
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
            </div>
          )}

          {/* 7. BROWSER NAVIGATE FIELDS */}
          {stepType === 'browser_navigate' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#E0F2FE] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Target Webpage URL
                </label>
                <input
                  type="url"
                  required
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  User Agent Header
                </label>
                <input
                  type="text"
                  value={browserUserAgent}
                  onChange={(e) => setBrowserUserAgent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
            </div>
          )}

          {/* 8. STAGEHAND ACT FIELDS */}
          {stepType === 'stagehand_act' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#FCE7F3] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Stagehand AI Action Instruction
                </label>
                <textarea
                  rows={2}
                  required
                  value={actAction}
                  onChange={(e) => setActAction(e.target.value)}
                  placeholder='e.g., "Click search button and submit input"'
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Target CSS Selector (Optional)
                </label>
                <input
                  type="text"
                  value={actSelector}
                  onChange={(e) => setActSelector(e.target.value)}
                  placeholder="button.submit-btn"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Input Value (Optional)
                </label>
                <input
                  type="text"
                  value={actValue}
                  onChange={(e) => setActValue(e.target.value)}
                  placeholder="Search query string"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
            </div>
          )}

          {/* 9. STAGEHAND EXTRACT FIELDS */}
          {stepType === 'stagehand_extract' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#ECFDF5] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  Natural Language Extraction Instruction
                </label>
                <textarea
                  rows={3}
                  required
                  value={extractInstruction}
                  onChange={(e) => setExtractInstruction(e.target.value)}
                  placeholder='e.g., "Extract product prices, titles, and availability status"'
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
            </div>
          )}

          {/* 10. STAGEHAND OBSERVE FIELDS */}
          {stepType === 'stagehand_observe' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#FEF3C7] border-[2.5px] border-[#111]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1">
                  CSS Filter Substring (Optional)
                </label>
                <input
                  type="text"
                  value={observeFilterSelector}
                  onChange={(e) => setObserveFilterSelector(e.target.value)}
                  placeholder="e.g., btn or input"
                  className="w-full px-3 py-2 rounded-lg border-[2px] border-[#111] bg-white text-xs font-medium"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t-[2.5px] border-[#111]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#F0EBE2] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#F5C842] hover:bg-[#E5B832] border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

