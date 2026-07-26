# 0021: P1 Integration Foundation

## Status

Accepted on 2026-07-26.

## Context

The feature list names integrations as a P1 priority covering HTTP, Slack, Teams, Gmail, Outlook, Google Drive, GitHub, databases, webhooks, and schedules. These capabilities need a project-scoped contract before production vendor SDKs, webhook dispatchers, durable schedules, and UI configuration screens are added.

## Decision

Add an integration domain policy with built-in integration definitions, connection records, invocation records, webhook endpoints, schedule triggers, action validation, credential requirements, and project-boundary checks. Add RBAC permissions for reading, managing, and running integrations.

Add an application service for listing definitions, creating project-scoped connections, binding credentials, invoking supported actions, storing invocation history, and registering webhook and schedule triggers. Use in-memory repositories and a deterministic integration gateway as replaceable infrastructure boundaries. Expose the use cases through framework-neutral integration HTTP routes. Extend the schema-driven node catalog with Teams, Gmail, Outlook, Google Drive, GitHub, database query, webhook, and schedule nodes.

## Consequences

- Integration behavior is testable without network, vendor SDK, database, or scheduler dependencies.
- Production adapters can replace the deterministic gateway without changing project authorization or invocation history rules.
- Credential requirements are enforced before integration connections are created.
- Webhook delivery, durable scheduling, OAuth flows, and production database drivers remain future adapter work.
