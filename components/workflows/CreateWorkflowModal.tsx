'use client';

import React, { useState } from 'react';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { CREATE_WORKFLOW } from '@/graphql/workflows/mutations';
import { useOrganization } from '@/hooks/useOrganization';
import { useRouter } from 'next/navigation';

export interface CreateWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkflowModal({ isOpen, onClose }: CreateWorkflowModalProps) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const { organization, canEditWorkflow } = useOrganization();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !canEditWorkflow) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organization?.id || !accessToken) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await executeGraphQL<{ insert_workflows_one: { id: string } }>(
        accessToken,
        CREATE_WORKFLOW,
        {
          org_id: organization.id,
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        }
      );

      const createdId = data.insert_workflows_one?.id;
      if (createdId) {
        onClose();
        router.push(`/dashboard/workflows/${createdId}`);
      } else {
        throw new Error('No workflow ID returned from creation mutation.');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to create workflow.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5EFE6]/85 backdrop-none">
      <div className="w-full max-w-lg bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5">
        <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
          <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">Create New Workflow</h2>
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
              id="create-wf-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Support Escalation Pipeline"
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#111] mb-1.5">
              Description
            </label>
            <textarea
              id="create-wf-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and automation flow of this workflow..."
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0EBE2] border-[2.5px] border-[#111]">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#111] block">
                Active Status
              </span>
              <span className="text-[11px] font-bold text-[#555] block">
                Active workflows can respond to triggers
              </span>
            </div>
            <input
              id="create-wf-active-toggle"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-5 w-5 border-[2px] border-[#111] accent-[#F5C842] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t-[2.5px] border-[#111]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-white border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#F0EBE2] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              id="submit-create-wf-btn"
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
