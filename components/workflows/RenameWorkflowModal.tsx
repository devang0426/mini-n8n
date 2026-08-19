'use client';

import React, { useState, useEffect } from 'react';
import { useAccessToken } from '@nhost/react';
import { renameWorkflow } from '@/lib/workflow/lifecycle';

interface RenameWorkflowModalProps {
  isOpen: boolean;
  workflowId: string | null;
  currentName: string;
  onClose: () => void;
  onRenamed: () => void;
}

export function RenameWorkflowModal({
  isOpen,
  workflowId,
  currentName,
  onClose,
  onRenamed,
}: RenameWorkflowModalProps) {
  const accessToken = useAccessToken();
  const [name, setName] = useState(currentName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
    setError(null);
  }, [currentName, isOpen]);

  if (!isOpen || !workflowId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await renameWorkflow(accessToken, workflowId, name);
      onRenamed();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to rename workflow.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5EFE6]/85 backdrop-none">
      <div className="w-full max-w-md bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-6 space-y-5">
        <div className="flex items-center justify-between border-b-[2.5px] border-[#111] pb-3">
          <h2 className="text-xl font-black uppercase tracking-wider text-[#111]">Rename Workflow</h2>
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
              New Workflow Name <span className="text-[#FF6B6B]">*</span>
            </label>
            <input
              id="rename-wf-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Release Pipeline v2"
              className="w-full px-3.5 py-2.5 rounded-xl border-[2.5px] border-[#111] bg-white text-sm font-medium text-[#111] shadow-[3px_3px_0_#111] focus:shadow-[4px_4px_0_#F5C842] focus:outline-none transition-all"
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
              id="confirm-rename-wf-btn"
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-[#F5C842] hover:bg-[#E5B832] disabled:opacity-50 border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Rename Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
