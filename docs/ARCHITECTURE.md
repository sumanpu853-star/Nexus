# Architecture

## Status

This repository now includes a small Node.js CLI that reviews the workspace against the architecture baseline. It also includes completed P0 foundations for authentication, signed sessions, auth/session HTTP handlers, RBAC, project-scoped workflow access, encrypted credentials, external secret provider resolution, secret redaction, safe execution gating, sandboxed runner boundaries, workflow DAG validation, workflow node retry/timeout policy validation, error branch planning, execution records, partial reruns, schema-driven node definitions, builder forms, and workflow templates. P1 execution diagnostics now add summarized execution history, node-level logs, diagnostic timelines, token/cost rollups, trace spans, observability reports, and execution HTTP routes. P1 RAG foundations now add project-scoped knowledge bases, document ingestion, chunking, embedding boundaries, vector search, reranking hooks, and knowledge base HTTP routes. P1 AI agent foundations now add project-scoped agents, model selection, prompt versions, memory scopes, tool permissions, visible tool-call records, and agent HTTP routes. P1 integration foundations now add an integration catalog, project-scoped connections, credential binding, deterministic gateway adapters, webhook endpoints, schedule triggers, integration node schemas, and integration HTTP routes.

## Guiding Principles

- Keep domain rules independent from frameworks, transport layers, and persistence details.
- Treat integrations as adapters around a small application core.
- Prefer explicit module boundaries over shared utility sprawl.
- Add tests at boundaries where behavior, state, or external effects can regress.
- Record significant tradeoffs in `docs/decisions`.

## Target Shape

Nexus should evolve toward these layers only when the codebase needs them:

1. Domain: business concepts, rules, and invariants.
2. Application: use cases, workflows, and orchestration.
3. Interface: HTTP, CLI, jobs, UI, or other entry points.
4. Infrastructure: databases, queues, APIs, filesystems, and vendor SDKs.

Dependencies should point inward: infrastructure and interfaces can depend on application code, application code can depend on domain code, and domain code should remain portable.

The repository reserves these directories for that shape:

- `src/domain`: rules, entities, value objects, domain services, security policy, credential policy, redaction rules, execution safety policy, workflow graph policy, workflow node execution policy, node definition policy, workflow template policy, error branch policy, execution planning, execution record policy, execution history policy, execution observability policy, knowledge base policy, agent policy, and integration policy.
- `src/application`: use cases, workflow orchestration, authentication, project-scoped access, credential vault orchestration, sandboxed runner orchestration, node catalog orchestration, workflow template orchestration, workflow execution orchestration, knowledge base orchestration, agent orchestration, and integration orchestration.
- `src/interfaces`: delivery mechanisms such as HTTP, CLI, jobs, UI, event handlers, auth handlers, builder handlers, execution handlers, knowledge base handlers, agent handlers, integration handlers, and framework-neutral route handlers.
- `src/infrastructure`: persistence, encryption, external secret providers, external APIs, filesystems, queues, execution storage adapters, knowledge repositories, embedding providers, vector indexes, agent repositories, model providers, tool registries, integration repositories, integration gateways, and vendor SDKs.
- `tests`: tests organized around behavior and architectural boundaries.

See `docs/BOUNDARIES.md` for dependency rules.

## Review Checklist

- Does each module have one clear reason to change?
- Are external systems hidden behind small interfaces?
- Can core behavior be tested without network, filesystem, or database access?
- Is configuration read at the edge rather than deep in domain code?
- Are errors modeled close to where recovery decisions are made?

## P1 Questions

- Is Nexus a service, library, web app, automation, desktop app, or mixed system?
- Which production HTTP server should bind the framework-neutral handlers?
- Which production vector store should replace the in-memory RAG vector index?
- Which production LLM provider should replace the deterministic agent model provider first?
- Which production integration adapters should replace the deterministic integration gateway first?
- Which production sandbox and external secret providers should ship first?
