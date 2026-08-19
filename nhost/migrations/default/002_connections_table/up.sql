-- ============================================================================
-- AI Agent Workflow Builder — Connections Schema Migration (Phase P3)
-- Table created: public.connections
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.connections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    provider                TEXT NOT NULL,
    type                    TEXT NOT NULL,
    encrypted_credentials   TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'Not tested',
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT connections_provider_check CHECK (
        provider IN ('groq', 'openai', 'gemini', 'openrouter', 'http')
    ),
    CONSTRAINT connections_type_check CHECK (
        type IN ('llm', 'http')
    ),
    CONSTRAINT connections_status_check CHECK (
        status IN ('Not tested', 'Connected', 'Test failed')
    )
);

COMMENT ON TABLE public.connections IS 'Secure organization connections storing encrypted credentials for LLM and HTTP workflow steps.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connections_org_id ON public.connections(org_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON public.connections(type);

-- Updated_at trigger
CREATE TRIGGER trg_connections_updated_at
    BEFORE UPDATE ON public.connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
