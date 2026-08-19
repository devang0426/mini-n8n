# Architectural & Technical Write-Up: Workflo AI Workflow Builder

## 1. Database Schema Reasoning & Multi-Tenant Design

The database schema is designed for multi-tenant isolation, deterministic state management, and atomic quota enforcement built on top of **PostgreSQL** (managed via **Nhost & Hasura GraphQL Engine**).

### Core Tables & Structure:
- **`organizations`**: Multi-tenant container holding organizational metadata and quota constraints (`quota_limit`, `quota_used`). Atomic quota checks are performed using PostgreSQL `FOR UPDATE` row locks during workflow execution to prevent race conditions.
- **`org_members`**: Role mapping linking `auth.users(id)` (managed natively by Nhost Auth) to organizations with explicit roles (`owner`, `editor`, `viewer`). No redundant `public.users` table is maintained.
- **`workflows`**: Workflow header definitions belonging strictly to an `org_id` with `is_active` status flag.
- **`workflow_steps`**: Ordered execution nodes (`position = 1..N`) with step types (`llm_call`, `http_request`, `db_write`, `notify`, `conditional_branch`, `approval_gate`) and JSONB configuration.
- **`workflow_triggers`**: Trigger mechanisms (`manual`, `webhook`) associated with workflows.
- **`workflow_runs` & `step_runs`**: Execution state tracking. `workflow_runs` tracks the overall run lifecycle (`pending` → `running` → `paused` → `completed` / `failed`), while `step_runs` tracks individual step outputs, execution duration, and error tracebacks.
- **`notifications` & `audit_logs`**: System audit trails and notification dispatch logs, protected at the DB layer to restrict inserts exclusively to `owner` roles.

---

## 2. Dual-Layer Permission System

Workflo employs a **defense-in-depth security model** with two distinct permission enforcement layers:

```text
+-----------------------------------------------------------------------------------+
|                            Client Request (Next.js UI)                            |
+-----------------------------------------------------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
+------------------------------------------+ +--------------------------------------+
| Layer 1: Hasura Row-Level Security (RLS) | | Layer 2: Server API & Execution Guard|
| Enforced at Database / GraphQL Layer     | | Enforced at Node.js Engine & AI      |
+------------------------------------------+ +--------------------------------------+
| • PostgreSQL row filtering by org_id     | | • Trusted session variable extraction|
| • Role checks via Hasura JWT claims      | | • SSRF loopback/private IP blocking  |
| • Table mutation restriction (db_write)  | | • Role capability & connection check|
+------------------------------------------+ +--------------------------------------+
```

### Layer 1: Hasura Row-Level Security (RLS) (Database / GraphQL Layer)
- Enforced automatically on every GraphQL query, mutation, and subscription by Hasura GraphQL Engine.
- Uses JWT session claims (`x-hasura-org-id`, `x-hasura-role`, `x-hasura-user-id`).
- All queries automatically filter rows using `org_id = x-hasura-org-id`. Users in Org B cannot view, query, or mutate resources belonging to Org A (returns 0 rows).
- Privileged operations (e.g., direct writes to `audit_logs` or `notifications`) are restricted at the Hasura metadata layer strictly to `role = 'owner'`.

### Layer 2: Server API & Execution Engine Guard (Application / Server Layer)
- Enforced inside Next.js API Routes (`/api/actions/trigger-workflow`, `/api/actions/approve-step`, `/api/ai/workflow-assistant`).
- Caller identity is extracted exclusively from trusted Hasura session variables (`session_variables['x-hasura-user-id']`). Untrusted request headers or payload overrides are ignored.
- Verifies organization membership, role capability (`owner` or `editor`), quota availability, and SSRF restrictions before executing HTTP steps or persisting AI workflow proposals.

---

## 3. Approval Gate (Human-in-the-Loop) Pause & Resume Architecture

The human-in-the-loop approval gate allows workflows to safely pause execution at critical steps (e.g., production deployments, database writes) until an authorized user manually approves the step.

### State Machine Lifecycle:

```text
[Step 1..K-1] ──> [Approval Gate Step K] ──> State: PAUSED ──> Halts Execution
                                                     │
                                             User Clicks Approve
                                                     │
                                                     v
[Step K+1..N] <── State: RUNNING <── Resumes from Step K+1 ── state updated to COMPLETED
```

1. **Pause Phase**:
   - The server execution engine processes steps sequentially ($1 \dots N$).
   - When encountering an `approval_gate` step, the engine creates a `step_runs` record with `status = 'paused'`, stores the gate message in `output`, and updates `workflow_runs.status = 'paused'`.
   - The engine loop returns early without advancing to subsequent steps, safely preserving the execution state.

2. **Resume Phase**:
   - An authorized user (`owner` or `editor` in the workflow's organization) views the paused run on the Approval Dashboard or Execution UI and clicks **"Approve Step"**.
   - The client invokes the `approveStepAction` Hasura Action (`POST /api/actions/approve-step`).
   - The action processor verifies the user's role and organization membership, updates the `step_runs` status to `'completed'` with approval metadata (`approved_by`, `approved_at`), and updates `workflow_runs.status` to `'running'`.
   - The `WorkflowExecutor` is invoked with `resumeFromStep = K + 1`, picking up execution directly at the step following the approval gate and running to completion.
