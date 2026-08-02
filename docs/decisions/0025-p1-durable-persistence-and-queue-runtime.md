# ADR 0025: P1 Durable Persistence And Queue Runtime Foundation

## Status

Accepted

## Context

Nexus now has project-scoped workflow, execution, deployment, integration, agent, RAG, and production adapter foundations. The remaining runtime gap is that most repositories are still in-memory and execution scheduling does not yet have a queue contract. Before introducing Postgres, Redis, or any other provider, the system needs stable persistence and queue semantics that can be tested without external services.

## Decision

Add a durable persistence and queue runtime foundation with:

- Domain-owned repository port definitions for durable resources and their required methods.
- Persistence migration metadata records and readiness reports.
- Workflow queue job records with idempotency keys, priority, availability, lease metadata, attempts, retry scheduling, completion, cancellation, and dead-letter states.
- A queue application service for worker leases, completion, failure, summaries, and worker authorization.
- A runtime persistence application service for repository ports, migration metadata, and readiness.
- In-memory repositories for queue jobs and migration metadata.
- A dependency-free JSON file durable store for local production-like snapshots.
- Framework-neutral HTTP handlers for queue and runtime persistence operations.
- Optional queue job emission from workflow execution creation when a queue repository is configured.

## Consequences

- Queue and persistence behavior is explicit and testable before selecting external providers.
- Existing in-memory execution flows continue to work when no queue repository is configured.
- Production providers can implement the same repository and queue contracts without changing domain behavior.
- This does not yet replace local adapters with Postgres or Redis; it defines the runtime contract those adapters must satisfy.
