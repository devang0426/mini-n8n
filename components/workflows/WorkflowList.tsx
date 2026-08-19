'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { GET_WORKFLOWS_BY_ORG } from '@/graphql/workflows/queries';
import { useOrganization } from '@/hooks/useOrganization';
import { CreateWorkflowModal } from './CreateWorkflowModal';
import { AiAssistantModal } from './AiAssistantModal';
import { TemplateGalleryModal } from './TemplateGalleryModal';
import { TemplateConfigModal } from './TemplateConfigModal';
import { RenameWorkflowModal } from './RenameWorkflowModal';
import { DeleteWorkflowModal } from './DeleteWorkflowModal';
import { WorkflowCard, WorkflowItem } from './WorkflowCard';
import { WorkflowTemplate } from '@/lib/templates/definitions';

type StatusFilter = 'all' | 'active' | 'disabled';
type SortOption = 'updated' | 'created' | 'name' | 'last_run';

export function WorkflowList() {
  const accessToken = useAccessToken();
  const { organization, isViewer, canEditWorkflow } = useOrganization();

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Modal Control States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const [renameState, setRenameState] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: '',
  });

  const [deleteState, setDeleteState] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: '',
  });

  const fetchWorkflows = useCallback(async () => {
    if (!organization?.id || !accessToken) {
      setWorkflows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await executeGraphQL<{ workflows: WorkflowItem[] }>(
        accessToken,
        GET_WORKFLOWS_BY_ORG,
        { org_id: organization.id }
      );
      setWorkflows(data.workflows || []);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch workflows for selected organization.');
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, accessToken]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Derived filtered & sorted workflow list
  const processedWorkflows = useMemo(() => {
    let result = [...workflows];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) => w.name.toLowerCase().includes(q) || (w.description && w.description.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter === 'active') {
      result = result.filter((w) => w.is_active === true);
    } else if (statusFilter === 'disabled') {
      result = result.filter((w) => w.is_active === false);
    }

    // 3. Sorting Logic
    result.sort((a, b) => {
      if (sortBy === 'updated') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'last_run') {
        const timeA = a.runs?.[0]?.created_at ? new Date(a.runs[0].created_at).getTime() : 0;
        const timeB = b.runs?.[0]?.created_at ? new Date(b.runs[0].created_at).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [workflows, searchQuery, statusFilter, sortBy]);

  if (!organization) {
    return (
      <div className="p-8 text-center bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111]">
        <h3 className="text-xl font-black uppercase text-[#111]">No Organization Selected</h3>
        <p className="text-xs font-bold text-[#555] uppercase mt-1">
          Please select an organization from the header dropdown.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header Info & Primary Create Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b-[2.5px] border-[#111]">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-[#111]">Workflows</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-[#555] mt-1">
            Managing workflows for <span className="text-[#111] font-black">{organization.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canEditWorkflow && (
            <>
              <button
                id="open-ai-assistant-btn"
                onClick={() => setIsAiModalOpen(true)}
                className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#A855F7] hover:bg-[#9333EA] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>✨</span>
                <span>Build with AI</span>
              </button>

              <button
                id="open-templates-btn"
                onClick={() => setIsTemplateGalleryOpen(true)}
                className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#FFF5CC] hover:bg-[#F5C842] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>📋</span>
                <span>Use Template</span>
              </button>

              <button
                id="open-create-wf-btn"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] hover:bg-[#E5B832] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>➕</span>
                <span>Start Blank</span>
              </button>
            </>
          )}

          {isViewer && (
            <span className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl bg-[#F0EBE2] text-[#555] border-[2px] border-[#111]">
              Read-only Viewer
            </span>
          )}
        </div>
      </div>

      {/* Toolbar: Search, Status Filters & Sort Controls */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[18px] p-4 shadow-[4px_4px_0_#111] flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="w-full md:w-72 relative">
          <input
            id="workflow-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows by name or description..."
            className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border-[2px] border-[#111] bg-white text-[#111] shadow-[2px_2px_0_#111] focus:outline-none focus:shadow-[3px_3px_0_#F5C842] transition-all"
          />
          <span className="absolute left-3 top-2.5 text-xs text-[#888]">🔍</span>
        </div>

        {/* Filter Pills & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Status Filters */}
          <div className="flex items-center space-x-1 bg-[#F5EFE6] p-1 rounded-xl border-[1.5px] border-[#111]">
            {(['all', 'active', 'disabled'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  statusFilter === f
                    ? 'bg-[#F5C842] text-[#111] border-[1.5px] border-[#111] shadow-[1px_1px_0_#111]'
                    : 'text-[#555] hover:text-[#111]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 text-xs font-black uppercase rounded-xl border-[1.5px] border-[#111] bg-white text-[#111] shadow-[1px_1px_0_#111]"
          >
            <option value="updated">Sort by Updated</option>
            <option value="created">Sort by Created</option>
            <option value="name">Sort by Name</option>
            <option value="last_run">Sort by Recent Run</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="py-12 flex items-center justify-center space-x-3 text-xs font-black uppercase tracking-wider">
          <svg className="animate-spin h-5 w-5 text-[#111]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading organization workflows...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FF6B6B] border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] text-xs font-bold text-white uppercase tracking-wider">
          <p className="font-black">Error:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && processedWorkflows.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#F5C842] border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] flex items-center justify-center text-2xl font-black text-[#111]">
            ⚡
          </div>
          <h3 className="text-xl font-black uppercase tracking-wider text-[#111]">
            {searchQuery ? 'No Matching Workflows' : 'No Workflows Created Yet'}
          </h3>
          <p className="text-xs font-bold uppercase tracking-wider text-[#555] max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? `No workflows match your search query "${searchQuery}".`
              : 'You haven\'t created any workflows in this organization yet.'}
          </p>

          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5EFE6] border-[2px] border-[#111] rounded-xl shadow-[2px_2px_0_#111] hover:bg-[#F5C842] transition-all"
            >
              Clear Search
            </button>
          ) : (
            canEditWorkflow && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsAiModalOpen(true)}
                  className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-[#A855F7] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#9333EA] transition-all"
                >
                  ✨ Build with AI
                </button>
                <button
                  onClick={() => setIsTemplateGalleryOpen(true)}
                  className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#FFF5CC] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#F5C842] transition-all"
                >
                  📋 Browse Templates
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#111] bg-[#F5C842] rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#E5B832] transition-all"
                >
                  ➕ Create Workflow
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Workflows Grid */}
      {!isLoading && !error && processedWorkflows.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {processedWorkflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onRefreshNeeded={fetchWorkflows}
              onOpenRename={(id, name) => setRenameState({ isOpen: true, id, name })}
              onOpenDelete={(id, name) => setDeleteState({ isOpen: true, id, name })}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateWorkflowModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          fetchWorkflows();
        }}
      />

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          fetchWorkflows();
        }}
      />

      {/* Template Gallery Modal */}
      <TemplateGalleryModal
        isOpen={isTemplateGalleryOpen}
        onClose={() => setIsTemplateGalleryOpen(false)}
        onSelectTemplate={(template) => setSelectedTemplate(template)}
      />

      {/* Template Configuration Modal */}
      <TemplateConfigModal
        isOpen={!!selectedTemplate}
        template={selectedTemplate}
        onClose={() => {
          setSelectedTemplate(null);
          fetchWorkflows();
        }}
      />

      {/* Rename Modal */}
      <RenameWorkflowModal
        isOpen={renameState.isOpen}
        workflowId={renameState.id}
        currentName={renameState.name}
        onClose={() => setRenameState({ isOpen: false, id: null, name: '' })}
        onRenamed={fetchWorkflows}
      />

      {/* Delete Modal */}
      <DeleteWorkflowModal
        isOpen={deleteState.isOpen}
        workflowId={deleteState.id}
        workflowName={deleteState.name}
        onClose={() => setDeleteState({ isOpen: false, id: null, name: '' })}
        onDeleted={fetchWorkflows}
      />
    </div>
  );
}
