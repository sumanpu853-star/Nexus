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
| Executions | Execution history, node-level logs, input/output snapshots, rerun from failed node | P1 | Completed |
| RAG | Knowledge base manager, document ingestion, chunking, embedding, vector search, reranking | P1 | In progress |
| AI Agents | Agent node with tools, memory, model selection, prompt/instruction editor, tool-call visibility | P1 | Completed |
| Integrations | HTTP, Slack/Teams, Gmail/Outlook, Google Drive, GitHub, databases, webhooks, schedules | P1 | In progress |
| Deployment | Save/publish states, webhook URLs, environment variables, dev/stage/prod separation | P1 | In progress |
| Observability | Logs, traces, metrics, cost tracking, token usage, latency, failure-rate dashboards | P1 | Completed |
| Collaboration | Workflow versions, compare, restore, comments, templates, import/export | P2 | Completed |
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
- Add queue-backed execution workers. Foundation implemented with queue jobs, leases, worker retries, dead-lettering, deterministic node runner adapters, and worker control routes.

### Phase 4: AI Agent Layer

- Add an agent node that can call tools and workflows. Foundation implemented with persisted-agent workflow node binding, a worker-compatible agent node runner, reusable knowledge-search and sub-workflow agent tools, and visible tool-call output in workflow node runs.
- Add tool permission controls. Foundation implemented with allowlisted tools, disabled-tool blocking, approval-required blocking, visible completed/failed/blocked tool-call records, and worker propagation of failed agent runs into failed workflow nodes.
- Add memory options: session memory, user memory, and semantic memory. Foundation implemented with normalized memory scopes and persisted memory messages, plus knowledge-search tool support for retrieved context.
- Add prompt/version history and model selection. Foundation implemented with project-scoped agents, prompt version records, configurable model metadata, and persisted-agent workflow node references.
- Add cost/token tracking. Foundation implemented at the execution and node-run observability boundary.

### Phase 5: Enterprise And Scale

- Add queue-based workers with Redis/Postgres. Foundation implemented with durable repository ports, migration metadata, a dependency-free JSON durable store, queue job records, leases, retry/dead-letter semantics, worker orchestration, a Redis-style queue repository, and Postgres-style runtime repositories.
- Add RBAC projects/workspaces. Foundation implemented with workspace records, owner/admin/member/viewer roles, membership permissions, workspace-to-project links, service orchestration, and HTTP routes.
- Add source control or workflow version export to Git. Foundation implemented with canonical workflow export files, manifest generation, source-control export records, and a source-control gateway boundary.
- Add external secrets integration. Foundation implemented with environment-backed secret resolution and chained provider fallback on the existing credential vault boundary.
- Add audit logs and an admin dashboard. Foundation implemented with audit event records, filtering, summaries, admin-gated listing, dashboard snapshots, and HTTP routes.

### P2 Collaboration

- Add workflow versions. Foundation implemented with immutable project-scoped workflow version snapshots and durable repository adapters.
- Add compare and restore. Foundation implemented with workflow version diff summaries and permission-gated restore that creates a new draft version.
- Add comments. Foundation implemented with workflow/node/version comments, metadata, resolution state, filtering, and HTTP routes.
- Add templates. Foundation implemented with collaboration templates created from workflow versions and project-scoped listing.
- Add import/export. Foundation implemented with portable workflow collaboration packages that include workflow state, versions, comments, and templates.

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

### Knowledge Base Object

Each knowledge base should include:

- `id`
- `project_id`
- `owner_id`
- `name`
- `description`
- `embedding_model`
- `chunking`
- `created_at`
- `updated_at`

Each ingested document should include source metadata, content hash, chunks, embedding references, and project-scoped vector search records.

### Agent Object

Each agent should include:

- `id`
- `project_id`
- `owner_id`
- `name`
- `description`
- `instructions`
- `model`
- `memory`
- `tools`
- `prompt_version`
- `created_at`
- `updated_at`

Each agent run should include input, output, model selection, memory policy, token usage, status, and visible tool-call records with allowed, blocked, failed, or completed outcomes.

### Integration Object

Each integration connection should include:

- `id`
- `project_id`
- `owner_id`
- `integration_type`
- `name`
- `credential_id`
- `settings`
- `status`
- `created_at`
- `updated_at`

Each integration invocation should track the connection, action, input, output, status, error, start time, finish time, and duration.

Webhook endpoints should map a project workflow to a stable path with optional connection and secret references. Schedule triggers should map a project workflow to a cron expression and timezone.

### Deployment Object

Each deployment environment should include:

- `id`
- `project_id`
- `environment`
- `variables`
- `created_at`
- `updated_at`

Each deployment should include:

- `id`
- `project_id`
- `workflow_id`
- `workflow_version`
- `environment`
- `status`
- `webhook_url`
- `variable_snapshot`
- `created_by`
- `created_at`
- `published_at`
- `disabled_at`

### Production Adapter Object

Each production adapter definition should include:

- `type`
- `category`
- `label`
- `description`
- `required`
- `capabilities`

Each production adapter config should include:

- `id`
- `adapter_type`
- `category`
- `provider`
- `status`
- `endpoint`
- `settings`
- `secret_ref`
- `capabilities`
- `created_at`
- `updated_at`

Each health check should include adapter type, health status, check time, latency, message, and details. Readiness reports should summarize required adapter coverage, missing required adapters, failing adapters, warning adapters, unchecked adapters, and the current production readiness status.

### Durable Persistence Object

Each repository port should include:

- `name`
- `resource`
- `required_methods`
- `transactional`
- `durability_required`

Each persistence migration should include:

- `id`
- `adapter_type`
- `version`
- `name`
- `checksum`
- `status`
- `applied_at`
- `error`
- `created_at`
- `updated_at`

### Workflow Queue Job Object

Each workflow queue job should include:

- `id`
- `type`
- `status`
- `priority`
- `idempotency_key`
- `payload`
- `attempts`
- `max_attempts`
- `available_at`
- `leased_by`
- `leased_at`
- `lease_expires_at`
- `completed_at`
- `failed_at`
- `last_error`
- `created_at`
- `updated_at`

### Workflow Collaboration Object

Each workflow version should include:

- `id`
- `project_id`
- `workflow_id`
- `version`
- `name`
- `description`
- `nodes`
- `edges`
- `settings`
- `change_summary`
- `source`
- `restored_from_version`
- `created_by`
- `created_at`

Each workflow comment should include:

- `id`
- `project_id`
- `workflow_id`
- `version`
- `node_id`
- `body`
- `author_id`
- `status`
- `metadata`
- `created_at`
- `resolved_by`
- `resolved_at`

Each workflow collaboration package should include:

- `format`
- `workflow`
- `versions`
- `comments`
- `templates`
- `exported_by`
- `exported_at`

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
| P1 observability dashboard filters, latency buckets, status breakdowns, failure rankings, slowest-node summaries, and cost/token breakdowns | Completed |
| P1 RAG knowledge base manager, ingestion/chunking, embedding boundary, vector search, reranking hooks, and knowledge search node schema | Completed |
| P1 AI agent model selection, prompt versions, memory scopes, tool permissions, deterministic model boundary, and visible tool-call records | Completed |
| P1 persisted-agent workflow node runner with knowledge-search and sub-workflow tools, tool-call visibility, failed-agent node propagation, and token/cost trace rollups | Completed |
| P1 integration catalog, project-scoped connections, credential binding, deterministic gateway, webhook endpoints, schedule triggers, and integration node schemas | Completed |
| P1 deployment environments, safe environment variable snapshots, publish records, active deployment lookup, stable webhook URLs, and deployment HTTP routes | Completed |
| P1 production adapter catalog, safe adapter configs, deterministic health gateway, readiness reports, and production adapter HTTP routes | Completed |
| P1 durable repository ports, migration metadata, local durable JSON store, workflow queue jobs, leases, retries, dead-lettering, queue summaries, and queue HTTP routes | Completed |
| P1 execution worker runtime with queue-backed job claiming, deterministic node runner boundary, run-next/run-until-idle controls, node result/log recording, business failure capture, and worker failure retry/dead-letter behavior | Completed |
| Phase 5 Redis-style workflow queue repository and Postgres-style runtime repositories | Completed |
| Phase 5 workspace RBAC roles, memberships, project links, service orchestration, and HTTP routes | Completed |
| Phase 5 workflow source-control export records, canonical files, manifest, and gateway boundary | Completed |
| Phase 5 environment-backed external secret provider and chained provider fallback | Completed |
| Phase 5 audit event records, admin-gated audit queries, dashboard snapshot aggregation, and HTTP routes | Completed |
| P2 workflow version snapshots, compare/diff summaries, restore, comments, templates, portable import/export packages, and HTTP routes | Completed |
| Schema-driven node catalog and workflow node parameter validation | Completed |
| Workflow templates and builder form contract | Completed |

## Implementation Rule

Build Nexus as an AI-native automation engine, not a generic workflow tool. Always implement planned work in priority order, starting with P0 production safety and security items.
