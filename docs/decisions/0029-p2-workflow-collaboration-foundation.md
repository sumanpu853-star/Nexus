# ADR 0029: P2 Workflow Collaboration Foundation

## Status

Accepted

## Context

The feature list defines P2 Collaboration as workflow versions, compare, restore, comments, templates, and import/export. Nexus already had project-scoped workflows, builder templates, source-control export boundaries, durable runtime repositories, and HTTP handler patterns. Collaboration needed to build on those foundations without weakening project permissions or turning the base workflow record into an overloaded audit log.

## Decision

Add collaboration as separate framework-neutral records and use cases:

- `src/domain/workflowCollaborationPolicy.js` defines workflow version snapshots, version diffs, workflow comments, collaboration templates, and portable workflow collaboration packages.
- `src/application/workflowCollaborationService.js` gates collaboration actions through existing project permissions, supports snapshot/list/compare/restore, comments and resolution, templates from versions, and package import/export.
- `src/infrastructure/inMemoryWorkflowCollaborationRepositories.js` stores workflow versions, comments, and templates behind repository ports.
- `src/infrastructure/postgresJsonRepository.js` exposes matching Postgres-style repositories for durable collaboration records.
- `src/interfaces/workflowCollaborationHttpHandler.js` exposes framework-neutral HTTP routes for collaboration workflows.
- `nexus.config.json` guards the new domain, application, interface, and infrastructure files.

## Consequences

- P2 Collaboration is complete at the framework-neutral backend foundation level.
- Workflow restore creates a new draft version instead of rewriting history in place.
- Compare output is deterministic and optimized for workflow/node/edge/settings review.
- Import/export packages preserve collaboration context across projects while assigning imported workflow ownership to the importing actor.
- Future UI work can attach visual version timelines, node comments, and package import screens without changing the core collaboration contracts.
