# AI Agent Workflow Builder (Workflo)

A production-grade, multi-tenant AI workflow automation platform inspired by n8n, built with **Next.js 16**, **Hasura GraphQL Engine**, **Nhost (PostgreSQL + Auth)**, and a deterministic **TypeScript Server Execution Engine**.

Users can construct, trigger, monitor, and approve multi-step automated workflows containing LLM prompts, external HTTP integrations, conditional logic, restricted database writes, system notifications, and human-in-the-loop approval gates.


---

## 📑 Submission & Evaluation Deliverables

1. **GitHub Repository**: [`https://github.com/devang0426/mini-n8n.git`](https://github.com/devang0426/mini-n8n.git)
2. **Architectural Write-Up**: Read the 1-page write-up covering schema reasoning, permission enforcement layers, and approval-gate pause/resume in [`ARCHITECTURE.md`](file:///c:/Users/HP/Desktop/workflo/ARCHITECTURE.md).
3. **Hasura Metadata & Schema Migrations**:
   - PostgreSQL Schema SQL: [`nhost/migrations/default/001_initial_schema/up.sql`](file:///c:/Users/HP/Desktop/workflo/nhost/migrations/default/001_initial_schema/up.sql)
   - Hasura Metadata & RLS Permissions: [`nhost/metadata/`](file:///c:/Users/HP/Desktop/workflo/nhost/metadata/)
4. **Scenario Recording & Demo**: Instructions below for running and recording the end-to-end execution flow.

---

## 🎯 Demo Login Credentials for Recruiters & Evaluators

Use these pre-seeded accounts to test live multi-tenant isolation and workflow capabilities:

### 🏢 Organization A (Acme Corp)
| Role | Email ID | Password | Permissions & Capabilities |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner.a@acme.com` | `DemoPassword123!` | Full access (create/edit workflows, step types `db_write`/`notify`, run workflows, manage members, approve gated steps). |
| **Editor** | `editor.a@acme.com` | `DemoPassword123!` | Create/edit workflows, run workflows, approve gated steps. |
| **Viewer** | `viewer.a@acme.com` | `DemoPassword123!` | Read-only access across Org A workflows, runs, and step progress. Cannot trigger or approve steps. |

### 🏢 Organization B (Beta Corp — Multi-Tenant Isolation Guard)
| Role | Email ID | Password | Permissions & Capabilities |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner.b@beta.com` | `DemoPassword123!` | Full access within Org B. (Completely isolated from Org A data). |
| **Viewer** | `viewer.b@beta.com` | `DemoPassword123!` | Read-only access within Org B. |

---

## Key Features

- **Multi-Tenant Architecture**: Strict organization isolation enforced at the PostgreSQL database layer using Hasura Row-Level Security (RLS) policies.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions per organization for `owner`, `editor`, and `viewer` roles.
- **Deterministic Workflow Execution Engine**: Server-side state machine managing run states (`pending` → `running` → `paused` → `completed` / `failed`).
- **6 Step Types Implemented**:
  1. `llm_call`: Prompt execution supporting real LLM providers (Groq/OpenRouter/Gemini) with structured output parsing and fallback output handling.
  2. `http_request`: External API calls with SSRF protection (loopback/private IP blocking), request timeouts, and 5xx transient retry handling.
  3. `db_write`: Secure, allowlisted database insertions into `audit_logs` and `notifications` (owner-restricted).
  4. `notify`: Real-time system notifications delivered via Hasura Event Triggers (owner-restricted).
  5. `conditional_branch`: Dynamic execution routing based on evaluating prior step outputs against custom rules.
  6. `approval_gate`: Human-in-the-loop pause and resume mechanism requiring explicit authorized approval.
- **2 Functional Trigger Mechanisms**:
  - `manual`: User-initiated direct executions via Hasura Action `triggerWorkflowRun`.
  - `webhook`: External HTTP POST ingestion endpoint (`/api/webhooks/[trigger_id]`) verified via `x-webhook-secret` signature headers.
- **Live GraphQL Subscriptions**: Real-time step progress and run state monitoring via Hasura subscriptions with automatic polling fallback.
- **Atomic Quota Enforcement**: Concurrency-safe quota verification using PostgreSQL `FOR UPDATE` row locks and atomic `quota_used` increments upon successful run completions.
- **Secure Connections & Credential Management**: Encrypted server-side credential storage (AES-256-GCM) for organization LLM and HTTP API steps, protecting secrets from browser exposure while maintaining full legacy environment fallback (`LLM_API_KEY`).
- **AI Workflow Assistant (Phase P7)**: Natural-language workflow proposal generation via `POST /api/ai/workflow-assistant`. Untrusted LLM outputs are machine-validated server-side against strict schema constraints, SSRF rules, role capabilities (`owner`, `editor`), and organization connection metadata, returning a transient proposal for interactive UI preview, editing, and explicit user confirmation before GraphQL persistence.
- **Onboarding, Templates & Product Polish (Phase P8)**: Zero-workflow onboarding experience (`Welcome to Workflo 👋`), 4 pre-built production templates (`AI Content Processor`, `Human Approval Pipeline`, `API Data Processor`, `AI Classification Workflow`), 3 clear creation entry points (`[ ✨ Build with AI ]`, `[ 📋 Use Template ]`, `[ + Start Blank ]`), global `Cmd + K` command search, app-wide toast notifications, and a responsive Neubrutalist UI system.
- **Cross-Organization Security Guard**: Comprehensive validation ensuring users in Org B cannot query, trigger, approve, or generate proposals using resources belonging to Org A.

---

## Architecture Overview

```text
+-------------------------------------------------------------------+
|                        Next.js 16 (React 19)                      |
|                  Dashboard / Builder / Execution UI               |
+-------------------------------------------------------------------+
                                  |
                                  | GraphQL Queries / Mutations / Subscriptions
                                  v
+-------------------------------------------------------------------+
|                       Hasura GraphQL Engine                       |
|           RLS Permissions | Event Triggers | Actions              |
+-------------------------------------------------------------------+
       |                          |                         |
       v                          v                         v
+--------------+        +-------------------+    +------------------+
| Nhost Auth   |        | PostgreSQL DB     |    | Server API Routes|
| auth.users   |        | Tables & Schema   |    | (Next.js Node)   |
+--------------+        +-------------------+    +------------------+
                                  ^                         |
                                  |                         |
                                  +-------------------------+
                                    Deterministic Step Execution Engine
                                    (State Machine & SSRF Protection)
```

### Folder Structure

```text
c:\Users\HP\Desktop\workflo
├── app/                        # Next.js App Router Pages & API Routes
│   ├── (dashboard)/            # Authenticated Dashboard Layout & Views
│   │   └── dashboard/          # Dashboard, Workflows, Runs, Approvals, Org & Profile
│   └── api/                    # Server API Routes (AI Assistant, Actions, Webhooks, Connections)
├── components/                 # React 19 Client Components (Neubrutalist Design Token System)
│   ├── dashboard/              # DashboardView & Metrics Cards
│   ├── layout/                 # Header, Sidebar & CommandPalette (⌘K)
│   ├── ui/                     # Toast Provider & Notifications
│   └── workflows/              # Canvas, Step/Trigger Builders, AI Modal & Template Gallery
├── lib/                        # Client & Shared Utilities (Auth Context, GraphQL Client, Templates)
├── server/                     # Server-Only Modules (AI Validator, Execution Engine, Connections, Encryption)
├── nhost/                      # Nhost & Hasura Metadata, Migrations & RLS Policies
├── scripts/                    # Seed Scripts (seed-demo.ts for Org A & Org B)
└── tests/                      # Automated Verification & Scenario Test Suites
```

---

## Security & Role Matrix

| Capability | Owner | Editor | Viewer |
| :--- | :---: | :---: | :---: |
| View Workflows / Runs / Approvals | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Create & Edit Workflows | ✅ Allowed | ✅ Allowed (Non-privileged steps) | ❌ Denied |
| Delete & Duplicate Workflows | ✅ Allowed | ❌ Denied | ❌ Denied |
| Create `db_write` or `notify` Steps | ✅ Allowed | ❌ Denied (Hasura RLS) | ❌ Denied |
| Manual Execution & Triggering | ✅ Allowed | ✅ Allowed | ❌ Denied |
| Approve Paused Gate Runs | ✅ Allowed | ✅ Allowed | ❌ Denied |
| Manage Organization Connections | ✅ Allowed | ❌ Read-Only Metadata | ❌ Read-Only Metadata |
| Manage Organization Members | ✅ Allowed | ❌ Denied | ❌ Denied |

### Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
# PUBLIC / BROWSER VARIABLES
NEXT_PUBLIC_NHOST_SUBDOMAIN="your-nhost-subdomain"
NEXT_PUBLIC_NHOST_REGION="your-nhost-region"
NEXT_PUBLIC_HASURA_GRAPHQL_URL="https://<subdomain>.hasura.<region>.nhost.run/v1/graphql"

# SERVER-ONLY VARIABLES (NEVER EXPOSED TO BROWSER)
HASURA_GRAPHQL_ADMIN_SECRET="your-hasura-admin-secret"
WEBHOOK_SECRET="your-webhook-secret"
LLM_API_KEY="your-llm-api-key"
CONNECTION_ENCRYPTION_KEY="32-byte-hex-string-for-aes-256-gcm"
APP_BASE_URL="http://localhost:3000"
```

To generate a secure 32-byte `CONNECTION_ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Getting Started & Verification

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Local Development Server

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Automated Test Suites

- **Master Verification Suite (70 Assertions)**:
  ```bash
  npx tsx tests/run_all_tests.ts
  ```
- **Final Integration & Isolation Suite (39 Assertions)**:
  ```bash
  npx tsx tests/run_final_integration.ts
  ```
- **Phase P7 AI Assistant Verification Suite (15 Assertions)**:
  ```bash
  npx tsx tests/run_phase7_tests.ts
  ```

### 4. Build Production Bundle

```bash
npm run build
```

---

## Primary Assignment Scenario Verification

### Org A Execution Flow:
1. **Workflow Composition**:
   `LLM Call` $\rightarrow$ `Conditional Branch` $\rightarrow$ `HTTP Request` $\rightarrow$ `Approval Gate` $\rightarrow$ `HTTP Request`
2. **Execution**:
   - Initiated via manual action or `POST /api/webhooks/[trigger_id]` with `x-webhook-secret`.
   - Transitions state: `pending` $\rightarrow$ `running` $\rightarrow$ `paused (approval gate)`.
   - Authorized user approves via `approveStepAction` $\rightarrow$ Resumes execution $\rightarrow$ Completes successfully.

### Org B Cross-Org Security Isolation:
- Users in Org B attempting to query Org A workflows, triggers, or runs receive **0 rows**.
- Direct API execution, trigger, approval, or connection requests targeting Org A resources return **HTTP 403 Forbidden**.

---

## Features Intentionally Deferred

Per architectural design, the following features are deferred and not included in this release:
- **P4 Integrations**: Slack & GitHub native API integrations.
- **P5 Triggers**: Scheduled cron triggers & Database Event triggers.
- **P6 Marketplace & Billing**: Commercial marketplace and payment provider integration.