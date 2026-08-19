# Phase — Production Codebase Cleanup + Professional README

The AI Agent Workflow Builder is functionally complete for the assignment.

Current verified state:

* PostgreSQL schema complete
* Hasura relationships and permissions complete
* Organization/RBAC security complete
* Cross-organization isolation verified
* All required workflow step types implemented
* Manual trigger implemented
* Webhook trigger implemented and verified
* LLM execution implemented
* HTTP execution implemented
* Conditional branching implemented
* DB write implemented
* Notify implemented
* Approval gate pause/resume implemented
* Retry handling implemented
* Quota enforcement implemented
* GraphQL subscriptions implemented
* Workflow builder implemented
* Live execution UI implemented
* 55/55 master tests passing
* 39/39 final integration assertions passing
* Next.js production build passing
* Webhook authentication verified
* Org B cannot trigger or approve Org A resources

The project is now entering submission preparation.

Your task is ONLY:

1. Clean up the codebase professionally.
2. Create/update a clear, reviewer-friendly README.md.

## CRITICAL RULE

Do NOT redesign the application.

Do NOT add new features.

Do NOT implement the AI Workflow Assistant.

Do NOT change authorization behavior.

Do NOT change workflow execution behavior.

Do NOT change database schema unless absolutely required to fix a genuine issue discovered during cleanup.

Do NOT weaken any security controls.

Do NOT remove tests simply because they are inconvenient.

The existing behavior must remain unchanged.

---

# PART 1 — CODEBASE AUDIT

First inspect the entire repository.

Review:

* app/
* components/
* hooks/
* lib/
* server/
* scripts/
* tests/
* migrations/
* Hasura metadata
* configuration files
* package.json
* environment files
* README
* documentation

Identify:

* dead code
* unused files
* unused imports
* duplicated utilities
* duplicated GraphQL logic
* unnecessary components
* stale comments
* outdated TODOs
* debug logs
* console.log statements that should not remain
* temporary/demo code
* inconsistent naming
* overly large files
* unnecessary abstractions
* hardcoded IDs
* hardcoded users
* hardcoded credentials
* environment-variable mistakes
* development-only code accidentally used in production
* misleading comments
* stale documentation
* incorrect route references
* unused dependencies

Do NOT immediately delete things.

Determine whether each item is actually unused before removing it.

---

# PART 2 — SECURITY CLEANUP

Perform a security-focused audit.

Verify that:

### Secrets

No:

* HASURA_GRAPHQL_ADMIN_SECRET
* LLM_API_KEY
* WEBHOOK_SECRET
* database credentials

are exposed to client-side code.

Do not create:

NEXT_PUBLIC_WEBHOOK_SECRET

or similar public secret variables.

### Authentication

Authenticated identity must come from trusted Nhost/Hasura session information.

Do not trust:

* arbitrary client user IDs
* arbitrary organization IDs
* client-provided roles

### Authorization

Preserve:

* owner
* editor
* viewer

permissions.

Preserve cross-organization isolation.

Preserve Action-level approval authorization.

### Webhook

Preserve:

* x-webhook-secret validation
* invalid secret → 401
* missing secret → 401
* cross-org access protection

### External HTTP

Preserve:

* SSRF protection
* request timeout
* retry behavior

Do not weaken security in the name of cleanup.

---

# PART 3 — CODE QUALITY

Improve code quality where safe.

Prefer:

* clear TypeScript types
* descriptive function names
* small focused functions
* reusable utilities
* consistent error handling
* consistent async/await
* early validation
* clear separation between UI, GraphQL, server logic and execution engine

Avoid unnecessary refactoring.

Do not rewrite working modules merely for stylistic preference.

---

# PART 4 — CLEAN PROJECT STRUCTURE

Ensure the repository has a clear structure similar to:

app/
login/
workflows/
api/

components/
workflows/
auth/
ui/

hooks/

lib/
auth/
graphql/

server/
workflow/

scripts/

tests/

migrations/

hasura/

docs/

The exact structure may differ based on the existing repository.

Do NOT move files unnecessarily.

If the current structure is already good, preserve it.

---

# PART 5 — TEST AND BUILD PRESERVATION

Before cleanup, record the current state:

```bash
npx tsx tests/run_final_integration.ts
npx tsx tests/run_all_tests.ts
npm run build
```

Expected:

* 39/39 final integration assertions
* 55/55 master tests
* successful production build

Then perform cleanup.

After cleanup, run the exact same commands again.

If any test fails:

1. determine whether the cleanup caused the failure
2. fix it
3. rerun the tests

Do not declare the cleanup complete while tests are failing.

---

# PART 6 — README.md

Create a professional README.md suitable for an internship/engineering assignment reviewer.

The README should be clear enough that someone unfamiliar with the repository can understand and run the project.

Use the following structure.

# AI Agent Workflow Builder

Short description:

A multi-tenant AI workflow automation platform inspired by n8n, built with Next.js, Hasura GraphQL, Nhost and PostgreSQL.

Explain that users can build multi-step workflows containing AI calls, HTTP integrations, conditional branches, database writes, notifications and human approval gates.

---

## Features

Document:

* Multi-tenant organizations
* Owner/editor/viewer roles
* Workflow builder
* LLM calls
* HTTP requests
* Conditional branching
* DB writes
* Notifications
* Approval gates
* Manual execution
* Webhook execution
* Live GraphQL subscriptions
* Retry handling
* Usage/quota enforcement
* Cross-organization isolation

---

## Architecture

Explain the architecture clearly.

Example:

```text
Next.js / React
      |
      | GraphQL
      v
Hasura GraphQL Engine
      |
      v
PostgreSQL
      |
      +---- Nhost Authentication
      |
      +---- Hasura Actions
      |
      +---- Workflow Execution Engine
                 |
                 +---- LLM Provider
                 |
                 +---- External HTTP APIs
```

Explain the responsibility of each layer.

---

## Tech Stack

Create a table containing:

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Frontend       | Next.js / React / TypeScript         |
| Styling        | Tailwind CSS / CSS                   |
| API            | GraphQL                              |
| GraphQL Engine | Hasura                               |
| Authentication | Nhost                                |
| Database       | PostgreSQL                           |
| Execution      | Node.js / TypeScript                 |
| LLM            | Groq/OpenRouter/Gemini               |
| Deployment     | Vercel or actual deployment platform |

Use the actual technologies from the repository.

Do not claim technologies that are not actually used.

---

## Data Model

Explain these entities:

* organizations
* org_members
* workflows
* workflow_steps
* workflow_triggers
* workflow_runs
* step_runs

Explain the main relationships.

Include a simple Mermaid ER diagram if Mermaid is appropriate for the repository.

---

## Authorization and Security

This section is extremely important.

Explain the two authorization layers.

### Layer 1 — Organization + Role

Explain:

owner:

* full organization/workflow control

editor:

* workflow editing and execution
* cannot manage organization members

viewer:

* read-only
* cannot execute workflows

Explain that authorization is scoped through org_members so users cannot access another organization's resources.

### Layer 2 — Step-Level / Runtime Authorization

Explain:

* db_write is owner-only
* notify is owner-only
* webhook triggers are owner-only
* approval is checked inside the server-side Action
* frontend UI hiding is not treated as authorization

Explain why approval requires Action-level validation.

---

## Workflow Execution

Explain the execution lifecycle:

```text
Trigger
  ↓
Authorization
  ↓
Quota Check
  ↓
workflow_run
  ↓
Step 1
  ↓
Step 2
  ↓
...
  ↓
Approval Gate
  ↓
Paused
  ↓
Approval
  ↓
Resume
  ↓
Completion
```

Explain retry handling and failure handling.

---

## Workflow Step Types

Document all implemented step types:

### llm_call

What it does and how the provider is configured.

### http_request

What it does and security protections.

### db_write

What it does and who can configure it.

### notify

What it does.

### conditional_branch

How previous step output controls branching.

### approval_gate

How the workflow pauses and resumes.

---

## Triggers

Document:

### Manual

Started through the UI.

### Webhook

Explain:

```text
POST /api/webhooks/[trigger_id]
```

Explain secret validation.

Do NOT include any actual secret.

### Scheduled / Database Event

Only document these if they are actually implemented and functional.

Do not claim unfinished functionality.

---

## GraphQL

Document the major GraphQL operations actually implemented.

Include examples or names for:

* workflow queries
* workflow mutations
* run mutations/actions
* approval action
* step_runs subscription

Do not expose admin secrets.

---

## Local Development

Give exact setup instructions.

Include:

### Prerequisites

* Node.js version if known
* npm
* Nhost/Hasura/PostgreSQL environment
* LLM provider API key

### Installation

```bash
npm install
```

### Environment variables

Document variable NAMES only.

Example:

```env
NHOST_SUBDOMAIN=
NHOST_REGION=
HASURA_GRAPHQL_ENDPOINT=
HASURA_GRAPHQL_ADMIN_SECRET=
LLM_API_KEY=
WEBHOOK_SECRET=
```

Use the actual variable names from the project.

Clearly mark which variables are server-only.

Never include real values.

### Run development server

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Tests

```bash
npx tsx tests/run_all_tests.ts
npx tsx tests/run_final_integration.ts
```

---

## Demo / Seed Data

Explain how to run the demo seed script if it is safe and actually supported.

Document:

* Org A
* Org B
* example roles
* example workflow

Do not include real passwords or secrets.

---

## Final Assignment Scenario

Create a section explaining exactly how to demonstrate the system.

Example:

```text
Org A Owner
    ↓
Open workflow
    ↓
Manual Run
    ↓
LLM
    ↓
Conditional Branch
    ↓
HTTP Request
    ↓
Approval Gate
    ↓
Paused
    ↓
Approve
    ↓
Resume
    ↓
Completed
```

Then demonstrate:

```text
Webhook
    ↓
POST /api/webhooks/[trigger_id]
    ↓
New workflow run
```

Then:

```text
Org B
    ↓
Cannot see Org A workflow
    ↓
Cannot trigger Org A workflow
    ↓
Cannot approve Org A workflow
```

---

## Security Verification

Document the verified results:

* cross-org isolation
* direct ID access protection
* role restrictions
* webhook authentication
* approval authorization
* secret isolation

Do not fabricate tests.

Use the actual verified results.

---

## Testing

Document the current verified results:

```text
Master Test Suite
55 / 55 passed

Final Integration Suite
39 / 39 passed

Production Build
Successful
```

Only include these if they still pass after cleanup.

---

## Project Structure

Show a concise directory tree based on the actual repository.

Do not invent directories.

---

## Deployment

Document the actual production deployment process.

If deployment is not completed yet, clearly mark it as:

`Deployment: Pending`

Do not invent a live URL.

---

## Known Limitations

Only include real limitations.

Do not hide meaningful limitations.

---

## Future Improvements

The AI Workflow Assistant may be mentioned here as a future enhancement.

Do not implement it.

---

# PART 7 — Documentation Accuracy

Before finishing, verify every README statement against the actual repository.

Do NOT claim:

* scheduled triggers if not implemented
* database event triggers if not implemented
* Slack/email integration if not actually functional
* production deployment if not deployed
* features that only exist as UI placeholders

The README must describe reality, not the intended architecture.

---

# PART 8 — Final Verification

After all cleanup:

Run:

```bash
npx tsx tests/run_final_integration.ts
npx tsx tests/run_all_tests.ts
npm run build
```

Also inspect git diff.

Make sure:

* no secrets were added
* no unrelated files changed
* no tests were removed
* no security checks were weakened
* no major behavior changed

Finally report:

## Cleanup Summary

* files removed
* files modified
* files reorganized
* duplicate/dead code removed
* security issues found
* documentation created

## Verification

* final integration tests
* master tests
* production build

## README

Confirm README.md is complete and accurate.

## Remaining Issues

List only genuine remaining issues.

STOP after completing this cleanup.
