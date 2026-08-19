-- ============================================================================
-- AI Agent Workflow Builder — Rollback Initial Schema
-- Drops everything created by up.sql in reverse dependency order.
-- ============================================================================

-- Drop updated_at triggers
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
DROP TRIGGER IF EXISTS trg_step_runs_updated_at ON public.step_runs;
DROP TRIGGER IF EXISTS trg_workflow_runs_updated_at ON public.workflow_runs;
DROP TRIGGER IF EXISTS trg_workflow_triggers_updated_at ON public.workflow_triggers;
DROP TRIGGER IF EXISTS trg_workflow_steps_updated_at ON public.workflow_steps;
DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.workflows;
DROP TRIGGER IF EXISTS trg_org_members_updated_at ON public.org_members;
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;

-- Drop trigger function
DROP FUNCTION IF EXISTS public.set_updated_at();

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.step_runs;
DROP TABLE IF EXISTS public.workflow_runs;
DROP TABLE IF EXISTS public.workflow_triggers;
DROP TABLE IF EXISTS public.workflow_steps;
DROP TABLE IF EXISTS public.workflows;
DROP TABLE IF EXISTS public.org_members;
DROP TABLE IF EXISTS public.organizations;
