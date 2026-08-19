-- ============================================================================
-- AI Agent Workflow Builder — Initial Schema
-- Phase 1: PostgreSQL Schema & Migrations
-- ============================================================================
-- 
-- Tables created:
--   1. organizations
--   2. org_members
--   3. workflows
--   4. workflow_steps
--   5. workflow_triggers
--   6. workflow_runs
--   7. step_runs
--   8. notifications
--   9. audit_logs
--
-- User identity source: auth.users (Nhost-managed)
-- No public.users table is created.
-- ============================================================================

-- ============================================================================
-- 1. organizations
-- ============================================================================
CREATE TABLE public.organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    quota_limit     INTEGER NOT NULL DEFAULT 100,
    quota_used      INTEGER NOT NULL DEFAULT 0,
    quota_reset_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT organizations_quota_non_negative CHECK (quota_used >= 0),
    CONSTRAINT organizations_quota_limit_positive CHECK (quota_limit > 0)
);

COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations. Quota columns support atomic enforcement via UPDATE ... WHERE quota_used < quota_limit.';
COMMENT ON COLUMN public.organizations.quota_reset_at IS 'Optional: timestamp when quota_used should be reset. Handled by application or cron, not DB trigger.';

-- ============================================================================
-- 2. org_members
-- ============================================================================
CREATE TABLE public.org_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT org_members_user_org_unique UNIQUE (user_id, org_id),
    CONSTRAINT org_members_role_check CHECK (role IN ('owner', 'editor', 'viewer'))
);

COMMENT ON TABLE public.org_members IS 'Maps users (auth.users) to organizations with role-based access. No duplicate public.users table.';

-- Indexes for org_members
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);

-- ============================================================================
-- 3. workflows
-- ============================================================================
CREATE TABLE public.workflows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflows IS 'Workflow definitions belonging to exactly one organization.';

-- Indexes for workflows
CREATE INDEX idx_workflows_org_id ON public.workflows(org_id);

-- ============================================================================
-- 4. workflow_steps
-- ============================================================================
CREATE TABLE public.workflow_steps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    step_type   TEXT NOT NULL,
    config      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT workflow_steps_position_unique UNIQUE (workflow_id, position),
    CONSTRAINT workflow_steps_step_type_check CHECK (
        step_type IN ('llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate')
    )
);

COMMENT ON TABLE public.workflow_steps IS 'Ordered steps within a workflow. Step type restrictions (role-based) enforced at Hasura permission layer, not here.';

-- Indexes for workflow_steps
CREATE INDEX idx_workflow_steps_workflow_position ON public.workflow_steps(workflow_id, position);

-- ============================================================================
-- 5. workflow_triggers
-- ============================================================================
CREATE TABLE public.workflow_triggers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    trigger_type    TEXT NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT workflow_triggers_type_check CHECK (
        trigger_type IN ('manual', 'webhook', 'scheduled', 'database_event')
    )
);

COMMENT ON TABLE public.workflow_triggers IS 'Trigger configurations for workflows. Manual + webhook implemented first; scheduled + database_event reserved for future.';

-- Indexes for workflow_triggers
CREATE INDEX idx_workflow_triggers_workflow_id ON public.workflow_triggers(workflow_id);

-- ============================================================================
-- 6. workflow_runs
-- ============================================================================
CREATE TABLE public.workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    trigger_type    TEXT,
    input           JSONB,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT workflow_runs_status_check CHECK (
        status IN ('pending', 'running', 'paused', 'completed', 'failed')
    )
);

COMMENT ON TABLE public.workflow_runs IS 'Execution instances of workflows. Status paused represents an approval gate waiting for human approval.';

-- Indexes for workflow_runs
CREATE INDEX idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_org_created ON public.workflow_runs(org_id, created_at);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);

-- ============================================================================
-- 7. step_runs
-- ============================================================================
CREATE TABLE public.step_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id     UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id    UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending',
    input               JSONB,
    output              JSONB,
    error               TEXT,
    attempt_count       INTEGER NOT NULL DEFAULT 1,
    approved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT step_runs_run_step_unique UNIQUE (workflow_run_id, workflow_step_id),
    CONSTRAINT step_runs_status_check CHECK (
        status IN ('pending', 'running', 'paused', 'completed', 'failed', 'skipped')
    )
);

COMMENT ON TABLE public.step_runs IS 'Individual step execution records. One row per workflow_run + workflow_step combination. Retries tracked via attempt_count.';

-- Indexes for step_runs
CREATE INDEX idx_step_runs_workflow_run_id ON public.step_runs(workflow_run_id);
CREATE INDEX idx_step_runs_workflow_step_id ON public.step_runs(workflow_step_id);

-- ============================================================================
-- 8. notifications
-- ============================================================================
CREATE TABLE public.notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_run_id     UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
    step_run_id         UUID REFERENCES public.step_runs(id) ON DELETE SET NULL,
    channel             TEXT NOT NULL DEFAULT 'in_app',
    recipient           TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_status     TEXT NOT NULL DEFAULT 'pending',
    delivered_at        TIMESTAMPTZ,
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT notifications_delivery_status_check CHECK (
        delivery_status IN ('pending', 'sent', 'delivered', 'failed')
    )
);

COMMENT ON TABLE public.notifications IS 'Notification records created by the notify step. Hasura Event Trigger on INSERT drives external delivery.';

-- Indexes for notifications
CREATE INDEX idx_notifications_org_created ON public.notifications(org_id, created_at);

-- ============================================================================
-- 9. audit_logs
-- ============================================================================
CREATE TABLE public.audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     UUID,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Lightweight audit trail for important operations. Immutable — no updated_at.';

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_org_created ON public.audit_logs(org_id, created_at);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- ============================================================================
-- Updated_at trigger function (shared)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all mutable tables
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_org_members_updated_at
    BEFORE UPDATE ON public.org_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_steps_updated_at
    BEFORE UPDATE ON public.workflow_steps
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_triggers_updated_at
    BEFORE UPDATE ON public.workflow_triggers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_runs_updated_at
    BEFORE UPDATE ON public.workflow_runs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_step_runs_updated_at
    BEFORE UPDATE ON public.step_runs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
