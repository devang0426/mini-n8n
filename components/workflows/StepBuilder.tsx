'use client';

import React, { useState } from 'react';
import { StepConfigModal } from './StepConfigModal';

export interface StepItem {
  id: string;
  position: number;
  step_type: string;
  config: Record<string, unknown>;
  isNew?: boolean;
}

export interface StepBuilderProps {
  steps: StepItem[];
  onChange: (updatedSteps: StepItem[]) => void;
  canEdit: boolean;
  isOwner: boolean;
}

const STEP_TYPE_NEOBRUTALIST_STYLES: Record<string, { fill: string; text: string; label: string }> = {
  llm_call: { fill: 'bg-[#EDE8FF]', text: 'text-[#5B3FC8]', label: 'LLM Call' },
  http_request: { fill: 'bg-[#DDEEFF]', text: 'text-[#1155AA]', label: 'HTTP Request' },
  conditional_branch: { fill: 'bg-[#FFF5CC]', text: 'text-[#8A6000]', label: 'Conditional Branch' },
  approval_gate: { fill: 'bg-[#FFDDEA]', text: 'text-[#B02050]', label: 'Approval Gate' },
  db_write: { fill: 'bg-[#D0FAF4]', text: 'text-[#0A7A6E]', label: 'DB Write' },
  notify: { fill: 'bg-[#FFE8CC]', text: 'text-[#B05000]', label: 'Notify Alert' },
  browser_navigate: { fill: 'bg-[#E0F2FE]', text: 'text-[#0284C7]', label: 'Browser Navigate' },
  stagehand_act: { fill: 'bg-[#FCE7F3]', text: 'text-[#DB2777]', label: 'Stagehand Act' },
  stagehand_extract: { fill: 'bg-[#ECFDF5]', text: 'text-[#059669]', label: 'Stagehand Extract' },
  stagehand_observe: { fill: 'bg-[#FEF3C7]', text: 'text-[#D97706]', label: 'Stagehand Observe' },
};

export function StepBuilder({ steps, onChange, canEdit, isOwner }: StepBuilderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);

  const handleAddStepClick = () => {
    setEditingStepIndex(null);
    setIsModalOpen(true);
  };

  const handleEditStepClick = (index: number) => {
    setEditingStepIndex(index);
    setIsModalOpen(true);
  };

  const handleDeleteStep = (index: number) => {
    const nextSteps = steps.filter((_, i) => i !== index);
    const reordered = nextSteps.map((s, idx) => ({ ...s, position: idx + 1 }));
    onChange(reordered);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const nextSteps = [...steps];
    const temp = nextSteps[index];
    nextSteps[index] = nextSteps[targetIndex];
    nextSteps[targetIndex] = temp;

    const reordered = nextSteps.map((s, idx) => ({ ...s, position: idx + 1 }));
    onChange(reordered);
  };

  const handleSaveStepConfig = (stepType: string, config: Record<string, unknown>) => {
    let nextSteps = [...steps];

    if (editingStepIndex !== null) {
      nextSteps[editingStepIndex] = {
        ...nextSteps[editingStepIndex],
        step_type: stepType,
        config,
      };
    } else {
      const newStep: StepItem = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        position: steps.length + 1,
        step_type: stepType,
        config,
        isNew: true,
      };
      nextSteps.push(newStep);
    }

    const reordered = nextSteps.map((s, idx) => ({ ...s, position: idx + 1 }));
    onChange(reordered);
  };

  const renderConfigSummary = (s: StepItem) => {
    const c = s.config || {};
    switch (s.step_type) {
      case 'llm_call':
        return `Model: ${c.model || 'gpt-4o'} • Prompt: "${c.prompt || 'Analyze...'}"`;
      case 'http_request':
        return `${c.method || 'GET'} ${c.url || 'https://...'}`;
      case 'db_write':
        return `Table: ${c.table || 'audit_logs'} (action: ${c.action || 'insert'})`;
      case 'notify':
        return `Recipient: ${c.recipient || 'N/A'} (channel: ${c.channel || 'in_app'})`;
      case 'conditional_branch':
        return `If '${c.field || 'status'}' ${c.operator || 'equals'} '${c.value ?? ''}'`;
      case 'approval_gate':
        return `Message: "${c.message || 'Awaiting human approval'}"`;
      case 'browser_navigate':
        return `URL: ${c.url || 'https://example.com'}`;
      case 'stagehand_act':
        return `Action: "${c.action || 'Perform action'}"${c.selector ? ` on ${c.selector}` : ''}`;
      case 'stagehand_extract':
        return `Instruction: "${c.instruction || 'Extract webpage data'}"`;
      case 'stagehand_observe':
        return `Observe elements on ${c.url || 'target page'}`;
      default:
        return JSON.stringify(c);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-[#111]">Workflow Execution Steps</h2>
          <p className="text-xs font-bold uppercase tracking-wider text-[#555]">
            Ordered sequential pipeline (1 to N)
          </p>
        </div>

        {canEdit && (
          <button
            id="add-step-btn"
            type="button"
            onClick={handleAddStepClick}
            className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1"
          >
            <span>+ Add Step</span>
          </button>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border-[2.5px] border-dashed border-[#111] shadow-[4px_4px_0_#111]">
          <p className="text-xs font-black uppercase text-[#111]">No steps added yet</p>
          {canEdit && (
            <button
              onClick={handleAddStepClick}
              className="mt-2 text-xs font-black uppercase tracking-wider text-[#7B5CF5] underline hover:text-[#111]"
            >
              Click here to add the first step
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const style = STEP_TYPE_NEOBRUTALIST_STYLES[step.step_type] || {
              fill: 'bg-white',
              text: 'text-[#111]',
              label: step.step_type,
            };

            return (
              <div
                key={step.id || `step-${idx}`}
                className={`p-4 ${style.fill} rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] flex items-center justify-between gap-4 transition-all`}
              >
                <div className="flex items-center space-x-4">
                  {/* Position Badge */}
                  <span className="h-8 w-8 rounded-full bg-white border-[2.5px] border-[#111] flex items-center justify-center font-black text-xs text-[#111] shadow-[1.5px_1.5px_0_#111]">
                    {step.position}
                  </span>

                  {/* Step Info & Summary */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <span className={`text-sm font-black uppercase tracking-wider ${style.text}`}>
                        {style.label}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded-md bg-white border-[1.5px] border-[#111] text-[#111]">
                        {step.step_type}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-[#111]/80">
                      {renderConfigSummary(step)}
                    </p>
                  </div>
                </div>

                {/* Actions: Move Up / Down / Edit / Delete */}
                {canEdit && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, 'up')}
                      title="Move Up"
                      className="px-2 py-1 text-xs font-black text-[#111] bg-white hover:bg-[#F5EFE6] disabled:opacity-30 rounded-lg border-[2px] border-[#111] shadow-[1.5px_1.5px_0_#111]"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => handleMoveStep(idx, 'down')}
                      title="Move Down"
                      className="px-2 py-1 text-xs font-black text-[#111] bg-white hover:bg-[#F5EFE6] disabled:opacity-30 rounded-lg border-[2px] border-[#111] shadow-[1.5px_1.5px_0_#111]"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditStepClick(idx)}
                      className="px-3 py-1 text-xs font-black uppercase tracking-wider text-[#111] bg-white hover:bg-[#F5C842] border-[2px] border-[#111] shadow-[2px_2px_0_#111] rounded-xl active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    >
                      Configure
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStep(idx)}
                      className="px-3 py-1 text-xs font-black uppercase tracking-wider text-white bg-[#FF6B6B] hover:bg-[#E55B5B] border-[2px] border-[#111] shadow-[2px_2px_0_#111] rounded-xl active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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

      {/* Config Modal */}
      <StepConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStepConfig}
        initialStepType={editingStepIndex !== null ? steps[editingStepIndex]?.step_type : 'llm_call'}
        initialConfig={editingStepIndex !== null ? steps[editingStepIndex]?.config : {}}
        isOwner={isOwner}
      />
    </div>
  );
}
