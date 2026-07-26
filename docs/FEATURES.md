# Nexus Feature List

This file is the product source of truth for Nexus feature priority.

Source note: this roadmap is based on the Nexus feature research document using official n8n and Botpress documentation as of July 11, 2026.

## Product Positioning

Nexus should be a secure visual AI workflow and agent orchestration platform for RAG, LLM tools, memory, webhooks, and business automation.

In simple terms: n8n-style automation plus Botpress-style AI agents, with production-grade security and observability.

## Current Priority Table

| Area | Feature | Priority | Status |
| --- | --- | --- | --- |
| Security | Real auth, JWT/session login, user ownership checks, RBAC, project/workspace isolation | P0 | In progress |
| Workflow Engine | DAG validation, branching, joins, retries, timeouts, error workflows, partial execution | P0 | Completed |
| Safe Execution | Replace raw `python_script` execution with a sandboxed code runner or disabled production mode | P0 | In progress |
| Credentials | Encrypted vault, credential ownership, credential sharing, external secret provider support | P0 | In progress |
| Builder UX | Schema-driven node forms instead of raw JSON textareas | P0 | Planned |
| Executions | Execution history, node-level logs, input/output snapshots, rerun from failed node | P1 | In progress |
| RAG | Knowledge base manager, document ingestion, chunking, embedding, vector search, reranking | P1 | Planned |
| AI Agents | Agent node with tools, memory, model selection, prompt/instruction editor, tool-call visibility | P1 | Planned |
| Integrations | HTTP, Slack/Teams, Gmail/Outlook, Google Drive, GitHub, databases, webhooks, schedules | P1 | Planned |
| Deployment | Save/publish states, webhook URLs, environment variables, dev/stage/prod separation | P1 | Planned |
| Observability | Logs, traces, metrics, cost tracking, token usage, latency, failure-rate dashboards | P1 | Planned |
| Collaboration | Workflow versions, compare, restore, comments, templates, import/export | P2 | Planned |
| Human-in-loop | Approval node, manual review queue, human handoff, timeout/fallback path | P2 | Planned |
| Marketplace | Plugin SDK, custom node packaging, verified community nodes, private nodes | P2 | Planned |

## Recommended MVP Roadmap

### Phase 1: Production Safety Gate

Fix the current blockers first:

- Add real authentication. Foundation implemented with password hashing, signed sessions, RBAC roles, and project-scoped workflow access.
- Scope credentials and workflows by user/project. Foundation implemented with project-scoped workflows and credentials.
- Disable or sandbox `python_script`. Default workflow creation now rejects `python_script` until a sandboxed runner is configured.
- Fix LanceDB overwrite behavior.
- Add execution redaction so secrets do not leak in logs/results. Foundation implemented with reusable redaction rules.

### Phase 2: Workflow Builder Upgrade

- Replace raw JSON config with typed forms.
- Add node schemas exposed from the backend through `GET /nodes`.
- Add validation before workflow execution. DAG validation now blocks invalid graph shapes before workflow persistence.
- Add workflow templates for common use cases.

### Phase 3: Execution Platform

- Store every execution with status, duration, `started_by`, trigger type, per-node input/output, and error. Foundation implemented with project-scoped execution records, node run snapshots, failure status, and redaction.
- Add retry policies, timeout policies, and error branches. Node-level retry/timeout policy validation and error branch planning are implemented before execution runner work.
- Add manual, production, and webhook execution modes. Mode and trigger validation are implemented at the execution record boundary.

### Phase 4: AI Agent Layer

- Add an agent node that can call tools and workflows.
- Add tool permission controls.
- Add memory options: session memory, user memory, and semantic memory.
- Add prompt/version history and model selection.
- Add cost/token tracking.

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
- duration, token usage, and cost
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

These items were completed before this product roadmap replaced the placeholder feature list:

| Feature | Status |
| --- | --- |
| Enforce architecture dependency boundaries | Completed |
| Human-friendly architecture failure output | Completed |
| Framework-neutral auth/session/RBAC/project-workflow isolation core | Completed |
| Project-scoped encrypted credential vault and redaction core | Completed |
| Disabled `python_script` workflow nodes until sandboxed runner exists | Completed |
| Workflow DAG validation before persistence | Completed |
| Workflow node retry and timeout policy validation before persistence | Completed |
| Workflow error branches, execution records, and partial rerun planning | Completed |

## Implementation Rule

Build Nexus as an AI-native automation engine, not a generic workflow tool. Always implement planned work in priority order, starting with P0 production safety and security items.
