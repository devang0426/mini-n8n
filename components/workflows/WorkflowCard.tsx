'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccessToken } from '@nhost/react';
import { useOrganization } from '@/hooks/useOrganization';
import { toggleWorkflowActive, duplicateWorkflow } from '@/lib/workflow/lifecycle';

export interface Step {
  id: string;
  position: number;
  step_type: string;
}

export interface Trigger {
  id: string;
  trigger_type: string;
  is_enabled: boolean;
}

export interface Run {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowItem {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps: Step[];
  triggers: Trigger[];
  runs: Run[];
}

interface WorkflowCardProps {
  workflow: WorkflowItem;
  onRefreshNeeded: () => void;
  onOpenRename: (wfId: string, currentName: string) => void;
  onOpenDelete: (wfId: string, name: string) => void;
}

export function WorkflowCard({
  workflow,
  onRefreshNeeded,
  onOpenRename,
  onOpenDelete,
}: WorkflowCardProps) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const { organization, canEditWorkflow, isViewer } = useOrganization();

  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const stepCount = workflow.steps?.length || 0;
  const triggerTypes = Array.from(
    new Set(workflow.triggers?.filter((t) => t.is_enabled).map((t) => t.trigger_type) || [])
  );
  const triggerSummary =
    triggerTypes.length > 0
      ? triggerTypes.map((t) => (t === 'webhook' ? 'Webhook' : 'Manual')).join(' + ')
      : 'Manual';

  const latestRun = workflow.runs?.[0] || null;

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !canEditWorkflow || isTogglingActive) return;

    setIsTogglingActive(true);
    try {
      await toggleWorkflowActive(accessToken, workflow.id, !workflow.is_active);
      onRefreshNeeded();
    } catch (err) {
      alert((err as Error).message || 'Failed to toggle active state.');
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !organization?.id || !canEditWorkflow || isDuplicating) return;

    setIsDuplicating(true);
    setMenuOpen(false);
    try {
      const newWfId = await duplicateWorkflow(accessToken, workflow.id, organization.id);
      router.push(`/dashboard/workflows/${newWfId}`);
    } catch (err) {
      alert((err as Error).message || 'Failed to duplicate workflow.');
      setIsDuplicating(false);
    }
  };

  const formatRelativeTime = (timestamp?: string | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const lastRunTimeFormatted = formatRelativeTime(latestRun?.completed_at || latestRun?.created_at);
  const updatedTimeFormatted = formatRelativeTime(workflow.updated_at);

  const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-[#A855F7] text-white border-[#111]',
    failed: 'bg-[#FF6B6B] text-white border-[#111]',
    running: 'bg-[#00C8B4] text-[#111] border-[#111] animate-pulse',
    paused: 'bg-[#F5C842] text-[#111] border-[#111]',
    pending: 'bg-[#E5E0D8] text-[#555] border-[#111]',
  };

  return (
    <div
      onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}
      className="p-5 bg-white rounded-2xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] hover:shadow-[6px_6px_0_#F5C842] hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between group relative"
    >
      <div>
        {/* Card Header & Badges */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-black uppercase tracking-wider text-[#111] group-hover:text-[#7B5CF5] transition-colors truncate">
              {workflow.name}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border-[1.5px] border-[#111] ${
                  workflow.is_active
                    ? 'bg-[#00C8B4] text-[#111]'
                    : 'bg-[#E5E0D8] text-[#555]'
                }`}
              >
                {workflow.is_active ? 'ACTIVE' : 'DISABLED'}
              </span>
              {updatedTimeFormatted && (
                <span className="text-[10px] font-bold text-[#888]">
                  Updated {updatedTimeFormatted}
                </span>
              )}
            </div>
          </div>

          {/* Action Menu Toggle */}
          {canEditWorkflow && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1.5 rounded-lg border-[2px] border-[#111] bg-[#F5EFE6] text-xs font-black hover:bg-[#F5C842] transition-all"
                title="Workflow Options"
              >
                •••
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-9 z-30 w-44 bg-white border-[2.5px] border-[#111] rounded-xl shadow-[4px_4px_0_#111] py-1 text-xs font-black uppercase"
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenRename(workflow.id, workflow.name);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F5EFE6] flex items-center space-x-2"
                  >
                    <span>✏️</span>
                    <span>Rename</span>
                  </button>

                  <button
                    onClick={handleDuplicate}
                    disabled={isDuplicating}
                    className="w-full text-left px-3 py-2 hover:bg-[#F5EFE6] flex items-center space-x-2 disabled:opacity-50"
                  >
                    <span>📋</span>
                    <span>{isDuplicating ? 'Duplicating...' : 'Duplicate'}</span>
                  </button>

                  <button
                    onClick={handleToggleActive}
                    disabled={isTogglingActive}
                    className="w-full text-left px-3 py-2 hover:bg-[#F5EFE6] flex items-center space-x-2"
                  >
                    <span>{workflow.is_active ? '⏸️' : '▶️'}</span>
                    <span>{workflow.is_active ? 'Disable' : 'Enable'}</span>
                  </button>

                  <div className="border-t-[1.5px] border-[#111] my-1" />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenDelete(workflow.id, workflow.name);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FF6B6B] hover:text-white flex items-center space-x-2 text-[#FF6B6B]"
                  >
                    <span>🗑️</span>
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs font-medium text-[#555] line-clamp-2 min-h-[2.25rem] mt-1">
          {workflow.description || 'No description provided.'}
        </p>

        {/* Info Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="px-2.5 py-1 rounded-lg bg-[#F5EFE6] border-[1.5px] border-[#111] text-[10px] font-black uppercase tracking-wider text-[#111]">
            {stepCount} Step{stepCount !== 1 ? 's' : ''}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#F5EFE6] border-[1.5px] border-[#111] text-[10px] font-black uppercase tracking-wider text-[#111]">
            {triggerSummary}
          </span>
        </div>
      </div>

      {/* Card Footer: Run Status & Action Buttons */}
      <div className="mt-5 pt-3 border-t-[1.5px] border-[#111] flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 min-w-0">
          <span className="text-[10px] font-bold text-[#666] uppercase">Last Run:</span>
          {latestRun ? (
            <div className="flex items-center space-x-1">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border-[1px] ${
                  STATUS_STYLES[latestRun.status] || STATUS_STYLES.pending
                }`}
              >
                {latestRun.status}
              </span>
              {lastRunTimeFormatted && (
                <span className="text-[10px] font-bold text-[#888]">
                  · {lastRunTimeFormatted}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-bold text-[#888] italic uppercase">Never run</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {canEditWorkflow && (
            <button
              onClick={handleToggleActive}
              disabled={isTogglingActive}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border-[1.5px] border-[#111] transition-all ${
                workflow.is_active
                  ? 'bg-white text-[#555] hover:bg-[#FF6B6B] hover:text-white'
                  : 'bg-[#00C8B4] text-[#111] hover:bg-[#00B4A2]'
              }`}
            >
              {workflow.is_active ? 'Disable' : 'Enable'}
            </button>
          )}

          <Link
            href={`/dashboard/workflows/${workflow.id}`}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-[#F5C842] text-[#111] rounded-lg border-[1.5px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#E5B832] transition-all"
          >
            {canEditWorkflow ? 'Edit' : 'View'}
          </Link>
        </div>
      </div>
    </div>
  );
}
