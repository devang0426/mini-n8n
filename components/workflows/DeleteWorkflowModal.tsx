'use client';

import React, { useState } from 'react';
import { useAccessToken } from '@nhost/react';
import { deleteWorkflow } from '@/lib/workflow/lifecycle';

interface DeleteWorkflowModalProps {
  isOpen: boolean;
  workflowId: string | null;
  workflowName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteWorkflowModal({
  isOpen,
  workflowId,
  workflowName,
  onClose,
  onDeleted,
}: DeleteWorkflowModalProps) {
  const accessToken = useAccessToken();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !workflowId) return null;

  const handleDelete = async () => {
    if (!accessToken) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteWorkflow(accessToken, workflowId);
      onDeleted();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete workflow.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5EFE6]/85 backdrop-none">
      <div className="w-full max-w-md bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5">
        <div className="flex items-center space-x-3 text-[#FF6B6B]">
          <div className="h-10 w-10 rounded-xl bg-[#FF6B6B] border-[2px] border-[#111] flex items-center justify-center text-white text-xl font-black shadow-[2px_2px_0_#111]">
            🗑️
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">Delete Workflow</h2>
            <p className="text-[10px] font-bold text-[#FF6B6B] uppercase tracking-wider">
              Destructive Action — Cannot be undone
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] text-xs font-bold text-white uppercase tracking-wider">
            {error}
          </div>
        )}

        <div className="bg-[#F5EFE6] p-4 rounded-xl border-[2px] border-[#111] space-y-2">
          <p className="text-xs font-bold text-[#111] uppercase tracking-wider">
            Are you sure you want to delete <strong className="text-[#FF6B6B] font-black">&ldquo;{workflowName}&rdquo;</strong>?
          </p>
          <p className="text-[11px] font-medium text-[#555]">
            This will permanently remove the workflow, its step configurations, trigger rules, and historical execution records.
          </p>
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
            id="confirm-delete-wf-btn"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#FF6B6B] hover:bg-[#E55B5B] disabled:opacity-50 text-white border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            {isSubmitting ? 'Deleting...' : 'Yes, Delete Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}
