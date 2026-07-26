# Architecture

## Status

This repository now includes a small Node.js CLI that reviews the workspace against the architecture baseline. It also includes completed P0 foundations for authentication, signed sessions, auth/session HTTP handlers, RBAC, project-scoped workflow access, encrypted credentials, external secret provider resolution, secret redaction, safe execution gating, sandboxed runner boundaries, workflow DAG validation, workflow node retry/timeout policy validation, error branch planning, execution records, partial reruns, schema-driven node definitions, builder forms, and workflow templates. P1 execution diagnostics now add summarized execution history, node-level logs, diagnostic timelines, and execution HTTP routes.

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

- `src/domain`: rules, entities, value objects, domain services, security policy, credential policy, redaction rules, execution safety policy, workflow graph policy, workflow node execution policy, node definition policy, workflow template policy, error branch policy, execution planning, execution record policy, and execution history policy.
- `src/application`: use cases, workflow orchestration, authentication, project-scoped access, credential vault orchestration, sandboxed runner orchestration, node catalog orchestration, workflow template orchestration, and workflow execution orchestration.
- `src/interfaces`: delivery mechanisms such as HTTP, CLI, jobs, UI, event handlers, auth handlers, builder handlers, execution handlers, and framework-neutral route handlers.
- `src/infrastructure`: persistence, encryption, external secret providers, external APIs, filesystems, queues, execution storage adapters, and vendor SDKs.
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
- Which vector store should back RAG ingestion?
- Which production sandbox and external secret providers should ship first?
