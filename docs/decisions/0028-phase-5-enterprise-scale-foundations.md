# ADR 0028: Phase 5 Enterprise Scale Foundations

## Status

Accepted

## Context

The feature list defines Phase 5 as the enterprise and scale layer: queue-based workers with Redis/Postgres, RBAC projects/workspaces, workflow export to source control, external secrets, audit logs, and an admin dashboard. Nexus already had framework-neutral P0/P1 foundations and queue-backed worker orchestration, but the enterprise features needed durable adapter boundaries and project/workspace administration without coupling the core to a specific HTTP server, Redis client, Postgres library, secret manager, or Git provider.

## Decision

Add Phase 5 as framework-neutral backend foundations:

- `src/infrastructure/redisWorkflowQueueRepository.js` provides a Redis-style workflow queue repository over an injected client.
- `src/infrastructure/postgresJsonRepository.js` provides Postgres-style JSON runtime repositories, including workspace, source-control export, audit, and earlier runtime record ports.
- `src/domain/workspacePolicy.js`, `src/application/workspaceAdministrationService.js`, and `src/interfaces/workspaceAdministrationHttpHandler.js` add workspace roles, membership permissions, project links, and delivery routes.
- `src/domain/workflowSourceControlPolicy.js`, `src/application/workflowSourceControlService.js`, and source-control infrastructure adapters add canonical workflow export files, manifests, export records, and a gateway boundary.
- `src/infrastructure/environmentExternalSecretProvider.js` adds environment-backed external secret resolution and chained provider fallback for the credential vault.
- `src/domain/auditPolicy.js`, `src/application/auditLogService.js`, `src/domain/adminDashboardPolicy.js`, `src/application/adminDashboardService.js`, and `src/interfaces/adminDashboardHttpHandler.js` add audit events, admin-gated audit queries, dashboard aggregation, and HTTP routes.
- `nexus.config.json` now guards the Phase 5 files through architecture checks.

## Consequences

- Phase 5 is complete at the framework-neutral backend foundation level.
- Runtime persistence, queueing, external secrets, source control, and admin reporting are replaceable behind explicit ports.
- Production deployments still need concrete package bindings for the selected Redis client, Postgres driver, Git hosting provider, HTTP server, and managed secret store.
- P2 collaboration can now build on workflow export/version primitives without weakening the existing security and observability boundaries.
