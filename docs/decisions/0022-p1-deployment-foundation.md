# 0022: P1 Deployment Foundation

## Status

Accepted on 2026-07-26.

## Context

The feature list names deployment as a P1 priority covering save/publish states, webhook URLs, environment variables, and dev/stage/prod separation. Nexus needs a clear deployment contract before production HTTP routing, durable workflow version storage, scheduler workers, and environment-specific runtime configuration are added.

## Decision

Add a deployment domain policy with supported environments, safe environment variable records, deployment records, stable webhook URL generation, status validation, and project-boundary checks. Add RBAC permissions for reading and managing deployments.

Add an application service for configuring project-scoped environments, publishing workflow draft versions into environments, snapshotting environment variables, disabling previous active deployments, updating workflow published state, listing deployments, and resolving the active deployment for a workflow/environment pair. Use in-memory deployment repositories as replaceable infrastructure boundaries. Expose the use cases through framework-neutral deployment HTTP routes.

## Consequences

- Deployment behavior is testable without a production server, database, scheduler, or reverse proxy.
- Secret environment variables reference credentials instead of storing raw secret values in deployment records.
- Publishing creates immutable deployment records while preserving an active deployment lookup per workflow/environment.
- Production routing, durable persistence, real webhook dispatch, schedule activation, and environment-specific worker execution remain future adapter work.
