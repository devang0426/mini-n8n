'use client';

import React, { useState } from 'react';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { CREATE_WORKFLOW } from '@/graphql/workflows/mutations';
import { CREATE_WORKFLOW_STEP } from '@/graphql/steps/mutations';
import { CREATE_WORKFLOW_TRIGGER } from '@/graphql/triggers/mutations';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useRouter } from 'next/navigation';
import { AIWorkflowProposal, AIStepProposal, AITriggerProposal, ValidationIssue } from '@/server/ai/types';

export interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditInCanvas?: (proposal: AIWorkflowProposal) => void;
}

export function AiAssistantModal({ isOpen, onClose, onEditInCanvas }: AiAssistantModalProps) {
  const router = useRouter();
  const { accessToken, userId } = useAuth();
  const { organization, canEditWorkflow, role } = useOrganization();

  // Mode: 'prompt' | 'preview'
  const [modalMode, setModalMode] = useState<'prompt' | 'preview'>('prompt');

  // Input State
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // Generated Proposal State (UNPERSISTED IN MEMORY ONLY!)
  const [proposal, setProposal] = useState<AIWorkflowProposal | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);

  if (!isOpen) return null;

  // Handle Generate Workflow Proposal
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || !organization?.id || !accessToken) return;

    setIsGenerating(true);
    setError(null);
    setValidationIssues([]);

    try {
      const res = await fetch('/api/ai/workflow-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'x-user-id': userId || accessToken,
        },
        body: JSON.stringify({
          prompt: promptText.trim(),
          org_id: organization.id,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.proposal) {
        setProposal(data.proposal);
        setModalMode('preview');
      } else {
        setError(data.error || 'Failed to generate a valid workflow proposal.');
        if (Array.isArray(data.issues)) {
          setValidationIssues(data.issues);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Network error while contacting AI assistant.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Explicit Confirmation & Persistence
  const handleConfirmAndCreate = async () => {
    if (!proposal || !organization?.id || !accessToken || !canEditWorkflow) return;

    setIsPersisting(true);
    setError(null);

    let createdWfId: string | null = null;

    try {
      // 1. Persist Workflow Header via Hasura GraphQL Mutation
      const wfRes = await executeGraphQL<{ insert_workflows_one: { id: string } }>(
        accessToken,
        CREATE_WORKFLOW,
        {
          org_id: organization.id,
          name: proposal.name.trim(),
          description: proposal.description ? proposal.description.trim() : null,
          is_active: proposal.is_active,
        }
      );

      createdWfId = wfRes.insert_workflows_one?.id || null;
      if (!createdWfId) {
        throw new Error('Failed to persist workflow header instance.');
      }

      // 2. Persist Steps
      for (const step of proposal.steps) {
        await executeGraphQL(accessToken, CREATE_WORKFLOW_STEP, {
          workflow_id: createdWfId,
          position: step.position,
          step_type: step.step_type,
          config: step.config || {},
        });
      }

      // 3. Persist Triggers
      for (const trig of proposal.triggers) {
        await executeGraphQL(accessToken, CREATE_WORKFLOW_TRIGGER, {
          workflow_id: createdWfId,
          trigger_type: trig.trigger_type,
          config: trig.config || {},
          is_enabled: trig.is_enabled,
        });
      }

      // Complete & Navigate to Editor Page
      onClose();
      router.push(`/dashboard/workflows/${createdWfId}`);
    } catch (err: any) {
      setError((err as Error).message || 'Failed to save workflow proposal.');
      setIsPersisting(false);
    }
  };

  const getStepTypeColor = (type: string) => {
    switch (type) {
      case 'llm_call':
        return 'bg-[#EDE8FF] text-[#5B21B6] border-[#5B21B6]';
      case 'http_request':
        return 'bg-[#E0F2FE] text-[#0369A1] border-[#0369A1]';
      case 'conditional_branch':
        return 'bg-[#FEF3C7] text-[#B45309] border-[#B45309]';
      case 'approval_gate':
        return 'bg-[#FEE2E2] text-[#B91C1C] border-[#B91C1C]';
      case 'db_write':
        return 'bg-[#DCFCE7] text-[#15803D] border-[#15803D]';
      case 'notify':
        return 'bg-[#FCE7F3] text-[#BE185D] border-[#BE185D]';
      default:
        return 'bg-[#F0EBE2] text-[#111] border-[#111]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5EFE6]/85 backdrop-none overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">✨</span>
            <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">
              {modalMode === 'prompt' ? 'AI Workflow Assistant' : 'Proposal Preview & Review'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] flex items-center justify-center font-black text-sm transition-all"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] text-xs font-bold text-white uppercase tracking-wider space-y-2">
            <p className="font-black">❌ {error}</p>
            {validationIssues.length > 0 && (
              <ul className="list-disc pl-5 font-mono text-[11px] normal-case space-y-1">
                {validationIssues.map((iss, idx) => (
                  <li key={idx}>
                    <strong className="uppercase">{iss.code}</strong> ({iss.path}): {iss.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* MODE 1: PROMPT INPUT */}
        {modalMode === 'prompt' && (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-2">
                Describe what you want to automate in natural language
              </label>
              <textarea
                id="ai-prompt-input"
                rows={4}
                required
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g. Create a workflow that receives customer feedback through a webhook, summarizes it with an LLM, and if urgent, calls my API endpoint."
                className="w-full px-4 py-3 rounded-xl border-[2.5px] border-[#111] bg-[#FFF5CC] text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all placeholder:text-[#555]"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#F0EBE2] border-[2px] border-[#111] text-xs text-[#555] space-y-1 font-bold">
              <p className="text-[#111] font-black uppercase">🔒 Security & Permission Boundary:</p>
              <p>• The AI assistant will output a structured proposal for your review.</p>
              <p>• No workflows, database tables, or execution steps will be created until you explicitly confirm.</p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t-[2.5px] border-[#111]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#F0EBE2] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                id="generate-proposal-btn"
                type="submit"
                disabled={isGenerating || !promptText.trim()}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-2"
              >
                <span>{isGenerating ? 'Generating Workflow Proposal...' : '✨ Generate Workflow Proposal'}</span>
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: PROPOSAL PREVIEW & REVIEW */}
        {modalMode === 'preview' && proposal && (
          <div className="space-y-5">
            {/* Proposal Details */}
            <div className="p-4 rounded-xl bg-[#FFF5CC] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#C49B10]">Unpersisted Draft Proposal</span>
                <span className="text-xs font-black uppercase text-[#0A6630] bg-[#B6F5C8] px-2 py-0.5 rounded border border-[#111]">
                  ✓ Machine Validated
                </span>
              </div>
              <h3 className="text-lg font-black uppercase text-[#111]">{proposal.name}</h3>
              <p className="text-xs font-medium text-[#555]">{proposal.description || 'No description provided.'}</p>
            </div>

            {/* Visual Workflow Diagram */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#111]">Proposed Execution Graph</h4>

              {/* Triggers */}
              <div className="space-y-2">
                {proposal.triggers.map((trig, idx) => (
                  <div
                    key={`trig-${idx}`}
                    className="p-3 bg-[#EDE8FF] rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] flex items-center justify-between text-xs font-bold"
                  >
                    <span className="px-2 py-0.5 rounded border border-[#111] bg-[#E5D4FF] text-[#5B21B6] font-black uppercase">
                      ⚓ TRIGGER: {trig.trigger_type.toUpperCase()}
                    </span>
                    <span className="font-mono text-[#555]">
                      {trig.trigger_type === 'webhook' ? 'Inbound HTTP Endpoint' : 'Manual UI Action'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Flow Connector Arrow */}
              <div className="text-center font-black text-lg text-[#111]">↓</div>

              {/* Steps */}
              <div className="space-y-3">
                {proposal.steps.map((step, idx) => {
                  const connId = (step.config.connection_id || step.config.connectionId) as string;
                  return (
                    <React.Fragment key={`step-${idx}`}>
                      <div className="p-4 bg-white rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border-[1.5px] ${getStepTypeColor(step.step_type)}`}>
                            Step {step.position}: {step.step_type.replace('_', ' ').toUpperCase()}
                          </span>
                          {connId && (
                            <span className="text-[11px] font-mono font-bold text-[#5B21B6] bg-[#EDE8FF] px-2 py-0.5 rounded border border-[#111]">
                              🔑 Connection Configured
                            </span>
                          )}
                        </div>

                        <h5 className="text-sm font-black text-[#111]">{step.name}</h5>

                        {/* Step Configuration Summary */}
                        <div className="p-2.5 bg-[#F0EBE2] rounded-lg border border-[#111] text-xs font-mono text-[#333] space-y-1">
                          {step.step_type === 'llm_call' && (
                            <div>
                              <strong>Model:</strong> {String(step.config.model || 'gpt-4o')} | <strong>Prompt:</strong> "{String(step.config.prompt).substring(0, 70)}..."
                            </div>
                          )}
                          {step.step_type === 'http_request' && (
                            <div>
                              <strong>Method:</strong> {String(step.config.method || 'GET')} | <strong>URL:</strong> {String(step.config.url)}
                            </div>
                          )}
                          {step.step_type === 'conditional_branch' && (
                            <div>
                              <strong>Field:</strong> {String(step.config.field)} | <strong>Operator:</strong> {String(step.config.operator)} | <strong>Value:</strong> {String(step.config.value)}
                            </div>
                          )}
                          {step.step_type === 'approval_gate' && (
                            <div>
                              <strong>Message:</strong> "{String(step.config.message)}"
                            </div>
                          )}
                          {step.step_type === 'db_write' && (
                            <div>
                              <strong>Table:</strong> {String(step.config.table)} | <strong>Action:</strong> insert
                            </div>
                          )}
                          {step.step_type === 'notify' && (
                            <div>
                              <strong>Recipient:</strong> {String(step.config.recipient)} | <strong>Channel:</strong> {String(step.config.channel)}
                            </div>
                          )}
                        </div>
                      </div>

                      {idx < proposal.steps.length - 1 && <div className="text-center font-black text-lg text-[#111]">↓</div>}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t-[2.5px] border-[#111] flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setModalMode('prompt')}
                  className="px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F0EBE2] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  🔄 Regenerate
                </button>
                {onEditInCanvas && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditInCanvas(proposal);
                      onClose();
                    }}
                    className="px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    ✏️ Edit in Canvas
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F0EBE2] transition-all"
                >
                  Cancel
                </button>
                <button
                  id="confirm-create-wf-btn"
                  type="button"
                  disabled={isPersisting}
                  onClick={handleConfirmAndCreate}
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#00C8B4] hover:bg-[#00B4A2] disabled:opacity-50 text-[#111] border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  {isPersisting ? 'Creating Workflow...' : '🚀 Confirm & Create Workflow'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
