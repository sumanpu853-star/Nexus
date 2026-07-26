# Nexus Feature List

This file is the product source of truth for Nexus feature priority.

Source note: this roadmap is based on the Nexus feature research document using official n8n and Botpress documentation as of July 11, 2026.

## Product Positioning

Nexus should be a secure visual AI workflow and agent orchestration platform for RAG, LLM tools, memory, webhooks, and business automation.

In simple terms: n8n-style automation plus Botpress-style AI agents, with production-grade security and observability.

## Current Priority Table

| Area | Feature | Priority | Status |
| --- | --- | --- | --- |
| Security | Real auth, JWT/session login, user ownership checks, RBAC, project/workspace isolation | P0 | Completed |
| Workflow Engine | DAG validation, branching, joins, retries, timeouts, error workflows, partial execution | P0 | Completed |
| Safe Execution | Replace raw `python_script` execution with a sandboxed code runner or disabled production mode | P0 | Completed |
| Credentials | Encrypted vault, credential ownership, credential sharing, external secret provider support | P0 | Completed |
| Builder UX | Schema-driven node forms instead of raw JSON textareas | P0 | Completed |
| Executions | Execution history, node-level logs, input/output snapshots, rerun from failed node | P1 | In progress |
| RAG | Knowledge base manager, document ingestion, chunking, embedding, vector search, reranking | P1 | Planned |
| AI Agents | Agent node with tools, memory, model selection, prompt/instruction editor, tool-call visibility | P1 | Planned |
| Integrations | HTTP, Slack/Teams, Gmail/Outlook, Google Drive, GitHub, databases, webhooks, schedules | P1 | Planned |
| Deployment | Save/publish states, webhook URLs, environment variables, dev/stage/prod separation | P1 | Planned |
| Observability | Logs, traces, metrics, cost tracking, token usage, latency, failure-rate dashboards | P1 | In progress |
| Collaboration | Workflow versions, compare, restore, comments, templates, import/export | P2 | Planned |
| Human-in-loop | Approval node, manual review queue, human handoff, timeout/fallback path | P2 | Planned |
| Marketplace | Plugin SDK, custom node packaging, verified community nodes, private nodes | P2 | Planned |

## Recommended MVP Roadmap

### Phase 1: Production Safety Gate

Fix the current blockers first:

- Add real authentication. Foundation implemented with password hashing, signed sessions, RBAC roles, project-scoped workflow access, and auth/session HTTP handlers.
- Scope credentials and workflows by user/project. Foundation implemented with project-scoped workflows and credentials.
- Disable or sandbox `python_script`. Default workflow creation now rejects `python_script` until a sandboxed runner is configured, and sandboxed runner execution is isolated behind an explicit service boundary.
- Fix LanceDB overwrite behavior. Audit completed: no LanceDB/vector-store code exists in this repo yet, so the blocker is not applicable until RAG storage is introduced.
- Add execution redaction so secrets do not leak in logs/results. Foundation implemented with reusable redaction rules.

### Phase 2: Workflow Builder Upgrade

- Replace raw JSON config with typed forms. Foundation implemented with schema-driven node definitions and typed parameter metadata.
- Add node schemas exposed from the backend through `GET /nodes`. Framework-neutral node catalog service and `/nodes` handler are implemented.
- Add validation before workflow execution. DAG validation and node parameter schema validation now block invalid workflows before persistence.
- Add workflow templates for common use cases. Built-in templates, builder form metadata, and framework-neutral builder handlers are implemented.

### Phase 3: Execution Platform

- Store every execution with status, duration, `started_by`, trigger type, per-node input/output, and error. Foundation implemented with project-scoped execution records, node run snapshots, failure status, redaction, summarized history, node-level logs, diagnostic timelines, token/cost rollups, trace spans, observability reports, and HTTP handlers.
- Add retry policies, timeout policies, and error branches. Node-level retry/timeout policy validation and error branch planning are implemented before execution runner work.
- Add manual, production, and webhook execution modes. Mode and trigger validation are implemented at the execution record boundary.

### Phase 4: AI Agent Layer

- Add an agent node that can call tools and workflows.
- Add tool permission controls.
- Add memory options: session memory, user memory, and semantic memory.
- Add prompt/version history and model selection.
- Add cost/token tracking. Foundation implemented at the execution and node-run observability boundary.

### Phase 5: Enterprise And Scale

- Add queue-based workers with Redis/Postgres.
- Add RBAC projects/workspaces.
- Add source control or workflow version export to Git.
- Add external secrets integration.
- Add audit logs and an admin dashboard.

## Feature Spec Highlights

### Workflow Object

Each workflow should include:

- `id`
- `name`
- `description`
- `owner_id`
- `project_id`
- `draft_version`
- `published_version`
- `nodes`
- `edges`
- `settings`
- `created_at`
- `updated_at`
- `published_at`
- `is_active`

### Node Schema

Each node should define:

- `type`
- `label`
- `category`
- `icon`
- input handles and output handles
- parameter schema
- credential requirements
- timeout/retry support
- safe logging/redaction rules

### Execution Object

Each execution should track:

- workflow ID and version
- trigger source: `manual`, `webhook`, `schedule`, or `sub-workflow`
- status: `queued`, `running`, `success`, `failed`, or `cancelled`
- node run records
- redacted state snapshots
- duration, token usage, cost, and trace spans
- error message and failed node ID

## Differentiating Features

Nexus should stand out through:

- AI-first workflow debugging: prompt, retrieved context, tool calls, and model output.
- Built-in RAG pipeline builder.
- Safe tool permissions per agent.
- Human approval gates for sensitive actions.
- Strong workflow security by default.
- Local/self-hostable deployment for privacy-sensitive teams.

## Completed Foundation Work

These implementation foundations are completed so far:

| Feature | Status |
| --- | --- |
| Enforce architecture dependency boundaries | Completed |
| Human-friendly architecture failure output | Completed |
| Framework-neutral auth/session/RBAC/project-workflow isolation core | Completed |
| Auth/session HTTP handlers | Completed |
| Project-scoped encrypted credential vault and redaction core | Completed |
| External secret provider resolution boundary | Completed |
| Disabled `python_script` workflow nodes until sandboxed runner exists | Completed |
| Sandboxed code runner service boundary | Completed |
| LanceDB overwrite audit | Completed |
| Workflow DAG validation before persistence | Completed |
| Workflow node retry and timeout policy validation before persistence | Completed |
| Workflow error branches, execution records, and partial rerun planning | Completed |
| P1 execution history summaries, node-level logs, timelines, and failed-node rerun routes | Completed |
| P1 execution token/cost rollups, trace spans, metrics, and observability report route | Completed |
| Schema-driven node catalog and workflow node parameter validation | Completed |
| Workflow templates and builder form contract | Completed |

## Implementation Rule

Build Nexus as an AI-native automation engine, not a generic workflow tool. Always implement planned work in priority order, starting with P0 production safety and security items.
