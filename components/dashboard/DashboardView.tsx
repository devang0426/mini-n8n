'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccessToken } from '@nhost/react';
import { executeGraphQL } from '@/lib/graphql/client';
import { useOrganization } from '@/hooks/useOrganization';
import { GET_WORKFLOWS_BY_ORG } from '@/graphql/workflows/queries';
import { GET_ORG_WORKFLOW_RUNS, GET_PENDING_APPROVALS } from '@/graphql/runs/queries';
import { CreateWorkflowModal } from '@/components/workflows/CreateWorkflowModal';

interface StepData {
  id: string;
  position: number;
  step_type: string;
}

interface TriggerData {
  id: string;
  trigger_type: string;
  is_enabled: boolean;
}

interface LatestRunData {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface WorkflowData {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps: StepData[];
  triggers: TriggerData[];
  runs: LatestRunData[];
}

interface WorkflowRunData {
  id: string;
  workflow_id: string;
  org_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  trigger_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  workflow?: {
    id: string;
    name: string;
  };
}

import { AiAssistantModal } from '@/components/workflows/AiAssistantModal';
import { TemplateGalleryModal } from '@/components/workflows/TemplateGalleryModal';
import { TemplateConfigModal } from '@/components/workflows/TemplateConfigModal';
import { WorkflowTemplate } from '@/lib/templates/definitions';

export function DashboardView() {
  const router = useRouter();
  const accessToken = useAccessToken();
  const { organization, role, canEditWorkflow, isViewer } = useOrganization();

  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [runs, setRuns] = useState<WorkflowRunData[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<WorkflowRunData[]>([]);
  const [connectionCount, setConnectionCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken || !organization?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Workflows for Active Org
      const wfRes = await executeGraphQL<{ workflows: WorkflowData[] }>(
        accessToken,
        GET_WORKFLOWS_BY_ORG,
        { org_id: organization.id }
      );

      // 2. Fetch Workflow Runs for Active Org
      const runsRes = await executeGraphQL<{ workflow_runs: WorkflowRunData[] }>(
        accessToken,
        GET_ORG_WORKFLOW_RUNS,
        { org_id: organization.id }
      );

      // 3. Fetch Pending Approvals for Active Org
      const approvalsRes = await executeGraphQL<{ workflow_runs: WorkflowRunData[] }>(
        accessToken,
        GET_PENDING_APPROVALS,
        { org_id: organization.id }
      );

      // 4. Fetch Safe Connections Count
      try {
        const connRes = await fetch(`/api/connections?org_id=${organization.id}`, {
          headers: { 'x-user-id': accessToken },
        });
        const connData = await connRes.json();
        if (connData.success && Array.isArray(connData.connections)) {
          setConnectionCount(connData.connections.length);
        }
      } catch {}

      setWorkflows(wfRes.workflows || []);
      setRuns(runsRes.workflow_runs || []);
      setPendingApprovals(approvalsRes.workflow_runs || []);
    } catch (err) {
      console.error('[DashboardView] Error fetching org data:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, organization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute Metrics from REAL Org Data
  const totalWorkflows = workflows.length;
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const pausedRuns = pendingApprovals.length;

  const finishedCount = completedRuns + failedRuns;
  const successRate = finishedCount > 0 ? Math.round((completedRuns / finishedCount) * 100) : null;

  const quotaLimit = organization?.quota_limit || 100;
  const quotaUsed = organization?.quota_used || 0;
  const quotaPercentage = Math.min(Math.round((quotaUsed / quotaLimit) * 100), 100);

  const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-[#A855F7] text-white border-[#111]',
    failed: 'bg-[#FF6B6B] text-white border-[#111]',
    running: 'bg-[#00C8B4] text-[#111] border-[#111] animate-pulse',
    paused: 'bg-[#F5C842] text-[#111] border-[#111]',
    pending: 'bg-[#E5E0D8] text-[#555] border-[#111]',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="flex items-center space-x-3 px-6 py-4 rounded-xl border-[2.5px] border-[#111] bg-white shadow-[4px_4px_0_#111]">
            <svg className="animate-spin h-5 w-5 text-[#111]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-xs font-black uppercase tracking-wider text-[#111]">
              Loading organization metrics & workflows...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 text-[#111]">
      {/* Header Banner & Quick Actions */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#F5C842] border-[1.5px] border-[#111]">
              {role?.toUpperCase()} ROLE
            </span>
            <span className="text-xs font-bold text-[#666]">
              Workspace: <strong className="text-[#111]">{organization?.name}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider mt-1 text-[#111]">
            Product Dashboard
          </h1>
          <p className="text-xs font-bold text-[#555] uppercase tracking-wider mt-1">
            Real-time workflow execution, metrics & organization operations
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {canEditWorkflow && (
            <>
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-3.5 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>✨ Build with AI</span>
              </button>
              <button
                onClick={() => setIsTemplateGalleryOpen(true)}
                className="px-3.5 py-2.5 bg-[#FFF5CC] hover:bg-[#F5C842] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>📋 Browse Templates</span>
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-2.5 bg-[#F5C842] hover:bg-[#E5B832] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>➕ Start Blank</span>
              </button>
            </>
          )}
          <Link
            href="/dashboard/workflows"
            className="px-3 py-2.5 bg-white hover:bg-[#F5EFE6] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            Workflows ({totalWorkflows})
          </Link>
          <Link
            href="/dashboard/runs"
            className="px-3 py-2.5 bg-white hover:bg-[#F5EFE6] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            Runs ({totalRuns})
          </Link>
          <Link
            href="/dashboard/approvals"
            className={`px-3 py-2.5 font-black text-xs uppercase tracking-wider rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all ${
              pausedRuns > 0 ? 'bg-[#FF6B6B] text-white animate-bounce' : 'bg-white text-[#111] hover:bg-[#F5EFE6]'
            }`}
          >
            Approvals ({pausedRuns})
          </Link>
        </div>
      </div>

      {/* NEW USER / ZERO WORKFLOW ONBOARDING BANNER */}
      {totalWorkflows === 0 && (
        <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] shadow-[6px_6px_0_#111] p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-block px-3 py-1 bg-[#F5C842] border-[1.5px] border-[#111] rounded-full text-xs font-black uppercase tracking-wider">
                Welcome to Workflo 👋
              </div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-[#111]">
                Build powerful AI & API workflows for your team
              </h2>
              <p className="text-xs font-medium text-[#555] leading-relaxed">
                Workflo lets you compose multi-step automations powered by LLMs, HTTP endpoints, PostgreSQL operations, and human approval gates. Get started in seconds using AI, pre-built templates, or a blank canvas.
              </p>
            </div>

            {/* Real Org Stats Pill */}
            <div className="bg-[#F5EFE6] border-[2px] border-[#111] rounded-2xl p-4 space-y-2 text-xs font-mono font-bold text-[#111] min-w-[220px]">
              <div className="text-[10px] uppercase text-[#666] font-black">Workspace Stats</div>
              <div>Organization: <span className="font-black text-[#111]">{organization?.name || 'Active Org'}</span></div>
              <div>Members: <span className="font-black text-[#111]">1</span></div>
              <div>Connections: <span className="font-black text-[#111]">{connectionCount}</span></div>
              <div>Workflows: <span className="font-black text-[#111]">0</span></div>
            </div>
          </div>

          {canEditWorkflow && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t-[2px] border-[#111]">
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-5 py-3 bg-[#A855F7] hover:bg-[#9333EA] text-white font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-2"
              >
                <span>✨ Build with AI</span>
              </button>
              <button
                onClick={() => setIsTemplateGalleryOpen(true)}
                className="px-5 py-3 bg-[#FFF5CC] hover:bg-[#F5C842] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-2"
              >
                <span>📋 Browse Templates</span>
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-3 bg-[#F5C842] hover:bg-[#E5B832] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[4px_4px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center space-x-2"
              >
                <span>➕ Create Workflow</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Approvals Warning Banner */}
      {pausedRuns > 0 && (
        <div className="bg-[#FF6B8A] border-[2.5px] border-[#111] rounded-[18px] shadow-[4px_4px_0_#111] p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⏳</span>
            <div>
              <div className="font-black text-sm uppercase tracking-wider">
                {pausedRuns} Pending Approval{pausedRuns > 1 ? 's' : ''} Awaiting Review
              </div>
              <div className="text-xs font-bold opacity-90">
                Workflows are paused at approval gates. Review and resume execution.
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/approvals"
            className="px-4 py-2 bg-white text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2px] border-[#111] shadow-[2px_2px_0_#111] hover:bg-[#F5C842] transition-all"
          >
            View Approvals Inbox
          </Link>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Workflows Metric */}
        <div className="bg-white border-[2.5px] border-[#111] rounded-[16px] p-5 shadow-[4px_4px_0_#111] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#555]">
            <span className="text-xs font-black uppercase tracking-wider">Workflows</span>
            <span className="text-xl">⚡</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-[#111]">{totalWorkflows}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#666] mt-1">
              Active in organization
            </div>
          </div>
        </div>

        {/* Total Runs Metric */}
        <div className="bg-white border-[2.5px] border-[#111] rounded-[16px] p-5 shadow-[4px_4px_0_#111] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#555]">
            <span className="text-xs font-black uppercase tracking-wider">Total Runs</span>
            <span className="text-xl">🔄</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-[#111]">{totalRuns}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#666] mt-1">
              Recorded executions
            </div>
          </div>
        </div>

        {/* Success Rate Metric */}
        <div className="bg-white border-[2.5px] border-[#111] rounded-[16px] p-5 shadow-[4px_4px_0_#111] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#555]">
            <span className="text-xs font-black uppercase tracking-wider">Success Rate</span>
            <span className="text-xl">📈</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-[#111]">
              {successRate !== null ? `${successRate}%` : 'N/A'}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#666] mt-1">
              {finishedCount > 0 ? `${completedRuns}/${finishedCount} completed` : 'No finished runs yet'}
            </div>
          </div>
        </div>

        {/* Quota Usage Metric */}
        <div className="bg-white border-[2.5px] border-[#111] rounded-[16px] p-5 shadow-[4px_4px_0_#111] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#555]">
            <span className="text-xs font-black uppercase tracking-wider">Quota Used</span>
            <span className="text-xl">📊</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#111]">
              {quotaUsed} <span className="text-sm font-bold text-[#666]">/ {quotaLimit}</span>
            </div>
            <div className="w-full bg-[#E5E0D8] h-2.5 rounded-full border-[1.5px] border-[#111] overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  quotaPercentage > 85 ? 'bg-[#FF6B6B]' : 'bg-[#7B5CF5]'
                }`}
                style={{ width: `${quotaPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Section: Workflow Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-wider text-[#111] flex items-center space-x-2">
            <span>Workflow Directory</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border-[1.5px] border-[#111]">
              {workflows.length}
            </span>
          </h2>
          <Link
            href="/dashboard/workflows"
            className="text-xs font-black uppercase tracking-wider text-[#7B5CF5] hover:underline"
          >
            View All Workflows →
          </Link>
        </div>

        {workflows.length === 0 ? (
          <div className="bg-white rounded-[20px] border-[2.5px] border-[#111] shadow-[6px_6px_0_#111] p-10 text-center space-y-3">
            <div className="text-4xl">⚡</div>
            <h3 className="text-lg font-black uppercase tracking-wider">No Workflows Created Yet</h3>
            <p className="text-xs font-bold text-[#666] max-w-md mx-auto uppercase tracking-wider">
              Get started by creating your first automated workflow in {organization?.name}.
            </p>
            {canEditWorkflow && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-2 px-5 py-2.5 bg-[#F5C842] text-[#111] font-black text-xs uppercase tracking-wider rounded-xl border-[2.5px] border-[#111] shadow-[3px_3px_0_#111] hover:bg-[#E5B832] transition-all"
              >
                Create Workflow
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {workflows.map((wf) => {
              const latestRun = wf.runs && wf.runs.length > 0 ? wf.runs[0] : null;
              const stepCount = wf.steps?.length || 0;
              const hasWebhook = wf.triggers?.some((t) => t.trigger_type === 'webhook' && t.is_enabled);

              return (
                <div
                  key={wf.id}
                  onClick={() => router.push(`/dashboard/workflows/${wf.id}`)}
                  className="bg-white border-[2.5px] border-[#111] rounded-[18px] p-5 shadow-[4px_4px_0_#111] hover:shadow-[6px_6px_0_#F5C842] hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-black text-base uppercase tracking-wider text-[#111] group-hover:text-[#7B5CF5] transition-colors truncate">
                        {wf.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border-[1.5px] border-[#111] ${
                          wf.is_active ? 'bg-[#00C8B4] text-[#111]' : 'bg-[#E5E0D8] text-[#555]'
                        }`}
                      >
                        {wf.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-[#555] line-clamp-2 min-h-[2rem]">
                      {wf.description || 'No description provided.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <span className="px-2.5 py-1 rounded-lg bg-[#F5EFE6] border-[1.5px] border-[#111] text-[10px] font-black uppercase tracking-wider">
                        {stepCount} Step{stepCount !== 1 ? 's' : ''}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#F5EFE6] border-[1.5px] border-[#111] text-[10px] font-black uppercase tracking-wider">
                        {hasWebhook ? '⚡ Webhook Enabled' : '👤 Manual Trigger'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t-[1.5px] border-[#111] flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-[#666]">Latest Run:</span>
                      {latestRun ? (
                        <span
                          className={`px-2 py-0.5 rounded-full font-black uppercase text-[9px] border-[1px] ${
                            STATUS_STYLES[latestRun.status] || STATUS_STYLES.pending
                          }`}
                        >
                          {latestRun.status}
                        </span>
                      ) : (
                        <span className="font-bold text-[#888] italic">Never run</span>
                      )}
                    </div>
                    <span className="font-bold text-[#7B5CF5] group-hover:translate-x-1 transition-transform">
                      Edit →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Workflow Runs List */}
      <div className="bg-white border-[2.5px] border-[#111] rounded-[20px] p-6 shadow-[6px_6px_0_#111]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-[#111]">
            Recent Execution Activity
          </h2>
          <Link
            href="/dashboard/runs"
            className="text-xs font-black uppercase tracking-wider text-[#7B5CF5] hover:underline"
          >
            View All Runs →
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold text-[#666] uppercase tracking-wider">
            No execution runs recorded for this organization yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-[2px] border-[#111] text-[#666] uppercase font-black text-[10px] tracking-wider">
                  <th className="pb-3">Run ID</th>
                  <th className="pb-3">Workflow</th>
                  <th className="pb-3">Trigger</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Started At</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] font-bold">
                {runs.slice(0, 5).map((run) => (
                  <tr key={run.id} className="hover:bg-[#F5EFE6] transition-colors">
                    <td className="py-3 font-mono text-[11px] text-[#111]">
                      {run.id.substring(0, 8)}...
                    </td>
                    <td className="py-3 font-black text-[#111]">
                      {run.workflow?.name || 'Workflow'}
                    </td>
                    <td className="py-3 uppercase text-[10px]">
                      {run.trigger_type || 'manual'}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border-[1px] ${
                          STATUS_STYLES[run.status] || STATUS_STYLES.pending
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 text-[#555]">
                      {run.started_at ? new Date(run.started_at).toLocaleString() : new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/dashboard/workflows/${run.workflow_id}/runs/${run.id}`}
                        className="px-2.5 py-1 text-[10px] font-black uppercase bg-[#F5C842] border-[1.5px] border-[#111] rounded-lg shadow-[1px_1px_0_#111] hover:bg-[#E5B832] transition-all"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          fetchData();
        }}
      />

      {/* AI Assistant Modal (Phase P7 Reuse) */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          fetchData();
        }}
      />

      {/* Template Gallery Modal (Phase P8) */}
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
          fetchData();
        }}
      />
    </div>
  );
}
