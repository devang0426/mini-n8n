'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { CREATE_WORKFLOW } from '@/graphql/workflows/mutations';
import { CREATE_WORKFLOW_STEP } from '@/graphql/steps/mutations';
import { CREATE_WORKFLOW_TRIGGER } from '@/graphql/triggers/mutations';
import { useOrganization } from '@/hooks/useOrganization';
import { useRouter } from 'next/navigation';
import { WorkflowTemplate } from '@/lib/templates/definitions';
import { useToast } from '@/components/ui/ToastContext';

export interface TemplateConfigModalProps {
  isOpen: boolean;
  template: WorkflowTemplate | null;
  onClose: () => void;
}

export function TemplateConfigModal({ isOpen, template, onClose }: TemplateConfigModalProps) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const { organization, canEditWorkflow } = useOrganization();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safe connections for active organization
  const [connections, setConnections] = useState<Array<{ id: string; name: string; provider: string; type: string }>>([]);
  const [selectedLlmConnId, setSelectedLlmConnId] = useState<string>('');
  const [selectedHttpConnId, setSelectedHttpConnId] = useState<string>('');

  const fetchConnections = useCallback(async () => {
    if (!organization?.id || !accessToken) return;
    try {
      const res = await fetch(`/api/connections?org_id=${organization.id}`, {
        headers: { 'x-user-id': accessToken },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.connections)) {
        setConnections(data.connections);
      }
    } catch {}
  }, [organization?.id, accessToken]);

  useEffect(() => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description);
      setError(null);
      fetchConnections();
    }
  }, [isOpen, template, fetchConnections]);

  if (!isOpen || !template) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organization?.id || !accessToken || !canEditWorkflow) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create Workflow Header
      const wfRes = await executeGraphQL<{ insert_workflows_one: { id: string } }>(
        accessToken,
        CREATE_WORKFLOW,
        {
          org_id: organization.id,
          name: name.trim(),
          description: description.trim() || null,
          is_active: true,
        }
      );

      const createdId = wfRes.insert_workflows_one?.id;
      if (!createdId) throw new Error('No workflow ID returned from creation mutation.');

      // 2. Create Steps (Attach selected connection IDs if applicable)
      for (const stepDef of template.steps) {
        const config: Record<string, unknown> = { ...stepDef.config };

        if (stepDef.step_type === 'llm_call' && selectedLlmConnId) {
          config.connection_id = selectedLlmConnId;
        } else if (stepDef.step_type === 'http_request' && selectedHttpConnId) {
          config.connection_id = selectedHttpConnId;
        }

        await executeGraphQL(accessToken, CREATE_WORKFLOW_STEP, {
          workflow_id: createdId,
          position: stepDef.position,
          step_type: stepDef.step_type,
          config,
        });
      }

      // 3. Create Triggers
      for (const trigDef of template.triggers) {
        await executeGraphQL(accessToken, CREATE_WORKFLOW_TRIGGER, {
          workflow_id: createdId,
          trigger_type: trigDef.trigger_type,
          config: trigDef.config,
          is_enabled: trigDef.is_enabled,
        });
      }

      showToast(`Workflow "${name}" created from template!`, 'success');
      onClose();
      router.push(`/dashboard/workflows/${createdId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow from template.');
      showToast('Failed to create workflow from template.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const llmConnections = connections.filter((c) => c.type === 'llm');
  const httpConnections = connections.filter((c) => c.type === 'http');

  const hasLlmStep = template.steps.some((s) => s.step_type === 'llm_call');
  const hasHttpStep = template.steps.some((s) => s.step_type === 'http_request');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5 my-8">
        <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider text-[#111]">Configure Template</h3>
            <p className="text-xs font-bold uppercase tracking-wider text-[#555]">
              {template.name} ({template.category})
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] flex items-center justify-center font-black text-sm transition-all"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] text-xs font-bold text-white uppercase tracking-wider">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
              Workflow Name <span className="text-[#FF6B6B]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
            />
          </div>

          {/* Connection Selectors */}
          {hasLlmStep && (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                LLM Secure Connection (Optional)
              </label>
              <select
                value={selectedLlmConnId}
                onChange={(e) => setSelectedLlmConnId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-xs font-black uppercase text-[#111] shadow-[2px_2px_0_#111]"
              >
                <option value="">Default / Environment Key Fallback</option>
                {llmConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    🔑 {c.name} ({c.provider})
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasHttpStep && (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
                HTTP Connection (Optional)
              </label>
              <select
                value={selectedHttpConnId}
                onChange={(e) => setSelectedHttpConnId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-xs font-black uppercase text-[#111] shadow-[2px_2px_0_#111]"
              >
                <option value="">No Authentication Header</option>
                {httpConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    🌐 {c.name} ({c.provider})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t-[2.5px] border-[#111]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#F0EBE2] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating Workflow...' : '🚀 Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
