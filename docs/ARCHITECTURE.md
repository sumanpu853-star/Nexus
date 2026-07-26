# Architecture

## Status

This repository now includes a small Node.js CLI that reviews the workspace against the architecture baseline. It also includes P0 product cores for authentication, signed sessions, RBAC, project-scoped workflow access, encrypted credentials, secret redaction, and safe execution gating.

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

- `src/domain`: rules, entities, value objects, domain services, security policy, credential policy, redaction rules, and execution safety policy.
- `src/application`: use cases, workflow orchestration, authentication, project-scoped access, and credential vault orchestration.
- `src/interfaces`: delivery mechanisms such as HTTP, CLI, jobs, UI, or event handlers.
- `src/infrastructure`: persistence, encryption, external APIs, filesystem, queues, and vendor SDKs.
- `tests`: tests organized around behavior and architectural boundaries.

See `docs/BOUNDARIES.md` for dependency rules.

## Review Checklist

- Does each module have one clear reason to change?
- Are external systems hidden behind small interfaces?
- Can core behavior be tested without network, filesystem, or database access?
- Is configuration read at the edge rather than deep in domain code?
- Are errors modeled close to where recovery decisions are made?

## Open Questions

- Is Nexus a service, library, web app, automation, desktop app, or mixed system?
- What are the first user-facing workflows?
- Which integrations or data stores are required?
