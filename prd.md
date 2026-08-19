# PRD: AI Agent Workflow Builder
**Stack:** nhost · Hasura · PostgreSQL · GraphQL · React/Next.js

---

## 1. Overview

Build a mini n8n — a multi-tenant workflow automation platform where users chain AI agent steps, manage execution, and approve gated steps. Every action is enforced by two independent permission layers.

**The acceptance criterion is a single live walkthrough**, not a checklist. All six scenario checks must hold simultaneously.

---

## 2. Data Model

### 2.1 Tables

#### `organizations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `quota_limit` | int | max LLM/external calls per period |
| `quota_used` | int | incremented on run completion |
| `quota_period_start` | timestamptz | reset anchor |
| `created_at` | timestamptz | |

#### `org_members`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `org_id` | uuid FK → organizations | |
| `user_id` | uuid FK → auth.users | |
| `role` | enum(`owner`, `editor`, `viewer`) | |
| `created_at` | timestamptz | |

**Unique constraint:** `(org_id, user_id)`

#### `workflows`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `org_id` | uuid FK → organizations | |
| `name` | text | |
| `description` | text | |
| `created_by` | uuid FK → auth.users | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `workflow_steps`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_id` | uuid FK → workflows | |
| `position` | int | execution order |
| `type` | enum (see §3) | |
| `config` | jsonb | step-specific params |
| `created_at` | timestamptz | |

#### `workflow_triggers`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_id` | uuid FK → workflows | |
| `type` | enum(`manual`, `webhook`, `scheduled`, `db_event`) | |
| `config` | jsonb | cron expr, watched table, webhook secret, etc. |
| `created_at` | timestamptz | |

#### `workflow_runs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_id` | uuid FK → workflows | |
| `triggered_by` | uuid FK → auth.users | nullable for non-manual |
| `trigger_type` | text | |
| `status` | enum(`pending`, `running`, `paused`, `completed`, `failed`) | |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | nullable |
| `error` | text | nullable |

#### `step_runs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_run_id` | uuid FK → workflow_runs | |
| `workflow_step_id` | uuid FK → workflow_steps | |
| `status` | enum(`pending`, `running`, `paused`, `completed`, `failed`, `skipped`) | |
| `input` | jsonb | |
| `output` | jsonb | nullable |
| `error` | text | nullable |
| `attempt_count` | int | default 0 |
| `approved_by` | uuid FK → auth.users | nullable |
| `approved_at` | timestamptz | nullable |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | nullable |

### 2.2 Computed Field / View

**`org_monthly_usage`** — Postgres view or Hasura computed field on `organizations`:

```sql
CREATE VIEW org_monthly_usage AS
SELECT
  w.org_id,
  COUNT(wr.id) AS runs_this_month,
  AVG(EXTRACT(EPOCH FROM (wr.completed_at - wr.started_at))) AS avg_run_duration_seconds
FROM workflow_runs wr
JOIN workflows w ON w.id = wr.workflow_id
WHERE wr.started_at >= date_trunc('month', now())
GROUP BY w.org_id;
```

Expose via Hasura as a computed field or tracked view with a relationship to `organizations`.

---

## 3. Step Types

| Type | Description | Config Shape |
|---|---|---|
| `llm_call` | Calls a real LLM API (Groq / OpenRouter / Gemini free tier). Retry once on failure. | `{ model, prompt_template, system_prompt }` |
| `http_request` | Generic external HTTP call. Retry once on failure. | `{ method, url, headers, body_template }` |
| `db_write` | Inserts/updates a row in your own tables. Owner-only step. | `{ table, operation, data_template }` |
| `notify` | Sends Slack/email alert via a Hasura Event Trigger. Owner-only step. | `{ channel, message_template }` |
| `conditional_branch` | Evaluates a JSONPath/JS expression against previous step output; sets next-step path. | `{ condition_expression, true_next, false_next }` |
| `approval_gate` | Pauses the run. Requires an Action handler role-check before resuming. | `{ required_role, instructions }` |

**Owner-only steps** (`db_write`, `notify`, and any `webhook` trigger): enforced at Hasura permission level — editors/viewers cannot insert workflow_steps with these types.

---

## 4. Trigger Types

| Type | Implementation |
|---|---|
| `manual` | Frontend "Run" button calls `triggerWorkflowRun` Action |
| `webhook` | Hasura Action endpoint — external POST starts a run |
| `scheduled` | Hasura Scheduled Event (cron) calls the Action handler |
| `db_event` | Hasura Event Trigger on a watched table row-change starts a run |

At least one non-manual trigger must be fully wired and demonstrable.

---

## 5. Permission Layers

### Layer 1 — Org + Role Scoping (Hasura Row-Level Permissions)

Every table permission filters through `org_members` to the caller's own org. Cross-org access is impossible even with the same role.

**`workflows` table example:**
```json
{
  "org_id": {
    "_in": {
      "_select": {
        "table": "org_members",
        "column": "org_id",
        "where": { "user_id": { "_eq": "X-Hasura-User-Id" } }
      }
    }
  }
}
```

Apply the same pattern to `workflow_steps`, `workflow_triggers`, `workflow_runs`, `step_runs`.

**Role matrix:**

| Operation | owner | editor | viewer |
|---|---|---|---|
| View workflows/steps/runs | ✅ own org | ✅ own org | ✅ own org |
| Create/edit workflows & steps | ✅ | ✅ | ❌ |
| Add `db_write` / `notify` / webhook trigger | ✅ | ❌ | ❌ |
| Trigger a run | ✅ | ✅ | ❌ |
| Manage org members | ✅ | ❌ | ❌ |

### Layer 2 — Step-Level Gating (Action Handler Logic)

Some decisions cannot be database permissions alone:

- **Approval gate:** `approveStep` Action handler fetches the approver's role from `org_members` at runtime. If not `owner` or `editor` in the workflow's org → reject with 403. Only then update `step_runs.approved_by/approved_at` and resume execution.
- **Quota check:** `triggerWorkflowRun` checks `quota_used < quota_limit` before creating a run.
- **Webhook trigger auth:** validate a secret token from `workflow_triggers.config` against the inbound header.

---

## 6. GraphQL Operations

### 6.1 Query — Org Workflows with Status
```graphql
query OrgWorkflows($org_id: uuid!) {
  workflows(where: { org_id: { _eq: $org_id } }) {
    id
    name
    workflow_steps(order_by: { position: asc }) {
      id
      type
      position
      config
    }
    workflow_triggers { id type config }
    workflow_runs(order_by: { started_at: desc }, limit: 1) {
      id
      status
      started_at
      completed_at
    }
  }
}
```

### 6.2 Mutation — Upsert Workflow + Steps + Triggers
```graphql
mutation UpsertWorkflow($workflow: workflows_insert_input!) {
  insert_workflows_one(
    object: $workflow,
    on_conflict: {
      constraint: workflows_pkey,
      update_columns: [name, description, updated_at]
    }
  ) {
    id
    workflow_steps { id }
    workflow_triggers { id }
  }
}
```

Use nested inserts for steps and triggers. Delete-and-reinsert steps when reordering.

### 6.3 Mutation — Approve Step
```graphql
mutation ApproveStep($step_run_id: uuid!) {
  approveStep(step_run_id: $step_run_id) {
    success
    workflow_run_id
    message
  }
}
```
(Backed by an Action handler — see §7.2)

### 6.4 Subscription — Live Step Progress
```graphql
subscription StepRunProgress($workflow_run_id: uuid!) {
  step_runs(
    where: { workflow_run_id: { _eq: $workflow_run_id } }
    order_by: { workflow_step: { position: asc } }
  ) {
    id
    status
    attempt_count
    started_at
    completed_at
    output
    error
    approved_by
    approved_at
    workflow_step { type position config }
  }
}
```

---

## 7. Action Handlers

### 7.1 `triggerWorkflowRun(workflow_id: uuid!) → TriggerResult`

**Handler logic (sequential, not background):**

```
1. Auth: verify caller is owner/editor in workflow's org via org_members
2. Quota: check org.quota_used < org.quota_limit — else return 429
3. Create workflow_run { status: 'running' }
4. For each step in order:
   a. Create step_run { status: 'pending' }
   b. Set step_run.status = 'running'
   c. Execute based on step.type:
      - llm_call: call LLM API; on failure retry once; on second fail set step_run.status='failed', workflow_run.status='failed', return
      - http_request: fetch external URL; same retry logic
      - db_write: perform the configured DB operation
      - notify: insert an event to trigger the Hasura Event Trigger
      - conditional_branch: evaluate condition against previous step_run.output; set next-step path
      - approval_gate: set step_run.status='paused', workflow_run.status='paused', STOP — return run_id to caller
   d. Set step_run.status='completed', step_run.output=result
5. Set workflow_run.status='completed'
6. Increment org.quota_used += 1
7. Return { run_id, status }
```

All status updates must happen via GraphQL mutations (or direct PG) so subscriptions reflect them live.

### 7.2 `approveStep(step_run_id: uuid!) → ApproveResult`

```
1. Fetch step_run → workflow_run → workflow → org_id
2. Check caller's role in org_members for that org_id — must be owner or editor
3. If not → return 403 { success: false, message: "Insufficient role" }
4. Set step_run { status:'completed', approved_by, approved_at }
5. Resume triggerWorkflowRun from the next step
   (or call a shared resumeRun(run_id, from_step_position) helper)
6. Return { success: true, workflow_run_id }
```

---

## 8. Frontend

### 8.1 Auth & Org Context
- nhost `useAuthenticated()` hook
- On login, fetch user's `org_members` rows; store active org in context
- Role stored in context — used to conditionally render UI elements

### 8.2 Workflow Builder Screen
- Sidebar: step type palette (drag or click to add)
- Canvas: ordered list of steps; drag to reorder
- Step config panel: type-specific form rendered from step type
- Trigger config: select trigger type + configure
- Save button → `UpsertWorkflow` mutation
- **Owner-only steps** (`db_write`, `notify`, webhook trigger): hidden from non-owners in the palette

### 8.3 Run View Screen
- "Run" button — hidden for viewers (`role === 'viewer'`)
- Calls `triggerWorkflowRun` on click
- Subscribes to `StepRunProgress` immediately after run starts
- Per-step status indicator: `pending → running → completed / failed / paused`
- On `paused` state: show "Awaiting Approval" banner + "Approve" button (visible to owner/editor only)
- Approve button calls `approveStep` mutation

### 8.4 Quota Indicator
- Query `org_monthly_usage` view
- Display: `{quota_used} / {quota_limit} calls used this month`
- Show warning at 80% usage

---

## 9. Hasura Configuration

### 9.1 Tracked Tables
Track all tables from §2. Set up all FK relationships as Hasura object/array relationships.

### 9.2 Event Triggers
- **`notify_step_trigger`**: fires on `step_runs` insert where `workflow_step.type = 'notify'` → calls notify handler function
- **`db_event_workflow_trigger`**: fires on insert/update of a designated watched table → calls `triggerWorkflowRun` for workflows with a `db_event` trigger configured on that table

### 9.3 Scheduled Events
- Cron job (e.g., `0 * * * *`) → calls a handler that queries `workflow_triggers` where `type = 'scheduled'`, checks if the cron expression matches current time, and calls `triggerWorkflowRun`

### 9.4 Hasura Actions
```yaml
# metadata/actions.yaml
- name: triggerWorkflowRun
  definition:
    kind: synchronous
    handler: {{FUNCTIONS_URL}}/triggerWorkflowRun
  permissions:
    - role: owner
    - role: editor

- name: approveStep
  definition:
    kind: synchronous
    handler: {{FUNCTIONS_URL}}/approveStep
  permissions:
    - role: owner
    - role: editor
```

---

## 10. File / Folder Structure

```
/
├── nhost/
│   └── metadata/           # Hasura metadata (actions, tables, permissions, event triggers)
├── functions/              # nhost serverless functions
│   ├── triggerWorkflowRun.ts
│   ├── approveStep.ts
│   ├── webhookTrigger.ts   # inbound webhook endpoint
│   ├── notifyHandler.ts    # event trigger handler
│   └── _utils/
│       ├── graphql.ts      # admin GraphQL client
│       ├── llm.ts          # LLM API wrapper with retry
│       └── permissions.ts  # shared role-check helpers
├── web/                    # Next.js app
│   ├── app/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   ├── workflows/
│   │   │   ├── [id]/
│   │   │   │   ├── builder/
│   │   │   │   └── run/[runId]/
│   │   └── settings/
│   ├── components/
│   │   ├── WorkflowCanvas.tsx
│   │   ├── StepNode.tsx
│   │   ├── RunView.tsx
│   │   ├── ApprovalBanner.tsx
│   │   └── QuotaIndicator.tsx
│   ├── lib/
│   │   ├── nhost.ts
│   │   ├── graphql/        # generated types + queries
│   │   └── hooks/
│   └── providers/
│       └── OrgContext.tsx
└── migrations/             # SQL migration files
    └── 001_initial_schema.sql
```

---

## 11. Environment Variables

```env
# nhost
NHOST_SUBDOMAIN=
NHOST_REGION=

# LLM (use at least one)
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=

# Hasura admin (for functions)
HASURA_GRAPHQL_ADMIN_SECRET=
HASURA_GRAPHQL_URL=

# Notify (optional but implement at least stub)
SLACK_WEBHOOK_URL=
```

---

## 12. Acceptance Scenario (must pass end-to-end)

Implement and verify all six checks in a single live walkthrough:

| # | Check | Implementation |
|---|---|---|
| 1 | **Two orgs, separate users/roles** | Seed script creates Org A (owner + editor + viewer) and Org B (owner) |
| 2 | **Org A workflow: llm_call + http_request + conditional_branch** | Builder UI; conditional routes on LLM output keyword |
| 3 | **Two trigger methods work** | Manual button + webhook POST (or event trigger) both start a run |
| 4 | **Approval gate pauses run; only owner/editor can approve** | `approval_gate` step; Org A viewer cannot approve; Org A editor can |
| 5 | **Live subscription, no refresh** | Step status updates stream in real time including `paused` state |
| 6 | **Org B cannot access Org A data** | Logged in as Org B owner: workflows query returns empty; direct UUID queries return empty; `triggerWorkflowRun` on Org A workflow returns 403; `approveStep` on Org A step_run returns 403 |

---

## 13. Implementation Order (recommended for Claude Code)

1. **Migrations** — write `001_initial_schema.sql` with all tables, enums, indexes, constraints
2. **Hasura metadata** — track tables, define all relationships, write permission rules for all roles
3. **Seed data** — two orgs, users, sample workflow
4. **Action handler: `triggerWorkflowRun`** — core execution engine with LLM + HTTP + retry
5. **Action handler: `approveStep`** — role check + resume logic
6. **Webhook + Event/Scheduled triggers** — wire at least one non-manual trigger
7. **Frontend: auth + org context** — nhost auth, OrgContext provider
8. **Frontend: workflow builder** — step palette, canvas, config panel, save
9. **Frontend: run view + subscription** — live status, approval UI, quota indicator
10. **End-to-end test** — run the acceptance scenario, fix any gaps

---

## 14. Key Constraints & Notes for Claude Code

- **Never use a shortcut that only works in a demo.** Permissions must be real Hasura row-level rules, not frontend-only guards.
- **Org scoping is mandatory on every query/mutation.** Filter via `org_members` subquery — never trust a client-supplied `org_id` alone.
- **`approveStep` role check must happen in the Action handler**, not only in DB permissions, because it's a mid-execution decision.
- **Subscriptions must use Hasura's native WebSocket protocol** — no polling.
- **Retry logic** for `llm_call` and `http_request`: attempt once, catch error, wait 1s, retry once more, then mark failed.
- **`conditional_branch`** must actually affect which subsequent steps run — not just log a value.
- **Quota increment** must happen atomically (use `_inc` in Hasura mutation or a PG function).
- Use **TypeScript** throughout functions and frontend.
- Use **GraphQL Code Generator** or similar for typed hooks in the frontend.