'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { UPDATE_WORKFLOW, DELETE_WORKFLOW } from '@/graphql/workflows/mutations';
import { CREATE_WORKFLOW_STEP, UPDATE_WORKFLOW_STEP, DELETE_WORKFLOW_STEP } from '@/graphql/steps/mutations';
import { CREATE_WORKFLOW_TRIGGER, UPDATE_WORKFLOW_TRIGGER, DELETE_WORKFLOW_TRIGGER } from '@/graphql/triggers/mutations';
import { useOrganization } from '@/hooks/useOrganization';
import { StepBuilder, StepItem } from './StepBuilder';
import { TriggerBuilder, TriggerItem } from './TriggerBuilder';
import { RunWorkflowButton } from './RunWorkflowButton';
import { RunHistory, WorkflowRunSummary } from './RunHistory';
import { WorkflowCanvas } from './WorkflowCanvas';

export type SaveState = 'IDLE' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR';

export interface FullWorkflowData {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  steps: StepItem[];
  triggers: TriggerItem[];
  runs?: WorkflowRunSummary[];
}

export interface WorkflowEditorProps {
  initialWorkflow: FullWorkflowData;
}

export function WorkflowEditor({ initialWorkflow }: WorkflowEditorProps) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const { canEditWorkflow, isOwner } = useOrganization();

  // Editor View Mode Toggle (Canvas vs List)
  const [editorView, setEditorView] = useState<'canvas' | 'list'>('canvas');

  // Workflow Metadata State
  const [name, setName] = useState<string>(initialWorkflow.name);
  const [description, setDescription] = useState<string>(initialWorkflow.description || '');
  const [isActive, setIsActive] = useState<boolean>(initialWorkflow.is_active);

  // Steps & Triggers State
  const [steps, setSteps] = useState<StepItem[]>(initialWorkflow.steps || []);
  const [triggers, setTriggers] = useState<TriggerItem[]>(initialWorkflow.triggers || []);

  // Track initial IDs for deletion persistence
  const [initialStepIds] = useState<string[]>((initialWorkflow.steps || []).map((s) => s.id));
  const [initialTriggerIds] = useState<string[]>((initialWorkflow.triggers || []).map((t) => t.id));

  // Save State Machine
  const [saveState, setSaveState] = useState<SaveState>('IDLE');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Mark DIRTY when fields change
  const markDirty = () => {
    if (saveState !== 'SAVING') {
      setSaveState('DIRTY');
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    markDirty();
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    markDirty();
  };

  const handleActiveToggle = (val: boolean) => {
    setIsActive(val);
    markDirty();
  };

  const handleStepsChange = (updatedSteps: StepItem[]) => {
    setSteps(updatedSteps);
    markDirty();
  };

  const handleTriggersChange = (updatedTriggers: TriggerItem[]) => {
    setTriggers(updatedTriggers);
    markDirty();
  };

  // Save Workflow Flow
  const handleSaveWorkflow = async () => {
    if (!accessToken || !canEditWorkflow) return;

    setSaveState('SAVING');
    setSaveError(null);

    try {
      // 1. Persist Workflow Metadata
      await executeGraphQL(accessToken, UPDATE_WORKFLOW, {
        id: initialWorkflow.id,
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
      });

      // 2. Persist Steps
      const currentStepIds = new Set(steps.map((s) => s.id));
      for (const oldId of initialStepIds) {
        if (!currentStepIds.has(oldId) && !oldId.startsWith('temp-')) {
          await executeGraphQL(accessToken, DELETE_WORKFLOW_STEP, { id: oldId });
        }
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const position = i + 1;

        if (step.id.startsWith('temp-') || step.isNew) {
          await executeGraphQL(accessToken, CREATE_WORKFLOW_STEP, {
            workflow_id: initialWorkflow.id,
            position,
            step_type: step.step_type,
            config: step.config || {},
          });
        } else {
          await executeGraphQL(accessToken, UPDATE_WORKFLOW_STEP, {
            id: step.id,
            position,
            step_type: step.step_type,
            config: step.config || {},
          });
        }
      }

      // 3. Persist Triggers
      const currentTriggerIds = new Set(triggers.map((t) => t.id));
      for (const oldId of initialTriggerIds) {
        if (!currentTriggerIds.has(oldId) && !oldId.startsWith('temp-')) {
          await executeGraphQL(accessToken, DELETE_WORKFLOW_TRIGGER, { id: oldId });
        }
      }

      for (const trig of triggers) {
        if (trig.id.startsWith('temp-') || trig.isNew) {
          await executeGraphQL(accessToken, CREATE_WORKFLOW_TRIGGER, {
            workflow_id: initialWorkflow.id,
            trigger_type: trig.trigger_type,
            config: trig.config || {},
            is_enabled: trig.is_enabled,
          });
        } else {
          await executeGraphQL(accessToken, UPDATE_WORKFLOW_TRIGGER, {
            id: trig.id,
            trigger_type: trig.trigger_type,
            config: trig.config || {},
            is_enabled: trig.is_enabled,
          });
        }
      }

      setSaveState('SAVED');
    } catch (err) {
      const msg = (err as Error).message || 'Failed to save workflow changes.';
      setSaveError(msg);
      setSaveState('ERROR');
    }
  };

  // Delete Workflow Flow
  const handleDeleteWorkflow = async () => {
    if (!accessToken || !canEditWorkflow) return;
    const confirmed = window.confirm(`Are you sure you want to delete workflow "${name}"? This action cannot be undone.`);
    if (!confirmed) return;

    setIsDeleting(true);
    setSaveError(null);

    try {
      await executeGraphQL(accessToken, DELETE_WORKFLOW, { id: initialWorkflow.id });
      router.push('/dashboard');
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to delete workflow.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Bar with Title, Save Status, & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b-[2.5px] border-[#111]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-black uppercase text-[#555] mb-1">
            <button onClick={() => router.push('/dashboard')} className="hover:underline">Workflows</button>
            <span>/</span>
            <span className="truncate max-w-[200px] text-[#111]">{name}</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-[#111]">{name || 'Untitled Workflow'}</h1>
        </div>

        {/* Save Status, View Mode & Action Controls */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white p-1 rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111]">
            <button
              type="button"
              onClick={() => setEditorView('canvas')}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                editorView === 'canvas' ? 'bg-[#F5C842] text-[#111] border-[1.5px] border-[#111]' : 'text-[#555] hover:text-[#111]'
              }`}
            >
              🎨 Canvas View
            </button>
            <button
              type="button"
              onClick={() => setEditorView('list')}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                editorView === 'list' ? 'bg-[#F5C842] text-[#111] border-[1.5px] border-[#111]' : 'text-[#555] hover:text-[#111]'
              }`}
            >
              📋 List View
            </button>
          </div>

          <RunWorkflowButton
            workflowId={initialWorkflow.id}
            isActive={isActive}
            onActivate={() => handleActiveToggle(true)}
          />

          <div className="text-xs font-black uppercase tracking-wider">
            {saveState === 'DIRTY' && <span className="text-[#C49B10] bg-[#FFF5CC] px-2.5 py-1 rounded-full border-[1.5px] border-[#111]">● Unsaved</span>}
            {saveState === 'SAVING' && <span className="text-[#5B3FC8] bg-[#EDE8FF] px-2.5 py-1 rounded-full border-[1.5px] border-[#111] animate-pulse">● Saving...</span>}
            {saveState === 'SAVED' && <span className="text-[#0A6630] bg-[#B6F5C8] px-2.5 py-1 rounded-full border-[1.5px] border-[#111]">✓ Saved</span>}
            {saveState === 'ERROR' && <span className="text-white bg-[#FF6B6B] px-2.5 py-1 rounded-full border-[1.5px] border-[#111]">❌ Failed</span>}
          </div>

          {canEditWorkflow && (
            <>
              <button
                id="save-workflow-btn"
                type="button"
                disabled={saveState === 'SAVING' || saveState === 'IDLE' || saveState === 'SAVED'}
                onClick={handleSaveWorkflow}
                className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#00C8B4] hover:bg-[#00B4A2] disabled:opacity-40 rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                {saveState === 'SAVING' ? 'Saving...' : 'Save Workflow'}
              </button>

              <button
                id="delete-workflow-btn"
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteWorkflow}
                className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#FF6B6B] hover:bg-[#E55B5B] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] rounded-xl active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <div className="p-4 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] text-xs font-bold text-white uppercase tracking-wider">
          <p className="font-black">Error:</p>
          <p className="mt-0.5">{saveError}</p>
        </div>
      )}

      {/* Interactive React Flow Canvas View */}
      {editorView === 'canvas' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">Interactive React Flow Visual Canvas</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-[#555]">
              Real-time node diagram & execution flow
            </p>
          </div>
          <WorkflowCanvas steps={steps} triggers={triggers} canEdit={canEditWorkflow} />
        </section>
      )}

      {/* Metadata Editing Section */}
      <section className="p-6 bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] space-y-4">
        <h2 className="text-lg font-black uppercase tracking-wider text-[#111]">Workflow Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
              Workflow Name
            </label>
            <input
              id="edit-wf-name"
              type="text"
              disabled={!canEditWorkflow}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
              Description
            </label>
            <input
              id="edit-wf-description"
              type="text"
              disabled={!canEditWorkflow}
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Workflow purpose..."
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t-[2.5px] border-[#111]">
          <span className="text-xs font-black uppercase tracking-wider text-[#111]">Active Execution State</span>
          <label className="flex items-center space-x-2.5 cursor-pointer">
            <input
              id="edit-wf-active-toggle"
              type="checkbox"
              disabled={!canEditWorkflow}
              checked={isActive}
              onChange={(e) => handleActiveToggle(e.target.checked)}
              className="h-5 w-5 border-[2px] border-[#111] accent-[#F5C842] cursor-pointer disabled:opacity-60"
            />
            <span className="text-xs font-black uppercase text-[#111]">
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </label>
        </div>
      </section>

      {/* Step Builder Section */}
      <section className="p-6 bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111]">
        <StepBuilder
          steps={steps}
          onChange={handleStepsChange}
          canEdit={canEditWorkflow}
          isOwner={isOwner}
        />
      </section>

      {/* Trigger Builder Section */}
      <section className="p-6 bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111]">
        <TriggerBuilder
          workflowId={initialWorkflow.id}
          triggers={triggers}
          onChange={handleTriggersChange}
          canEdit={canEditWorkflow}
          isOwner={isOwner}
        />
      </section>

      {/* Run History Section */}
      <section className="p-6 bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111]">
        <RunHistory workflowId={initialWorkflow.id} runs={initialWorkflow.runs || []} />
      </section>
    </div>
  );
}
