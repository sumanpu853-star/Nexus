# ADR 0024: P1 Production Adapter Readiness

## Status

Accepted

## Context

Nexus has P1 foundations for executions, RAG, AI agents, integrations, observability, and deployments, but those foundations still rely on deterministic or in-memory adapters. Before adding concrete Postgres, Redis, vector store, LLM, integration, scheduler, sandbox, or secret-provider implementations, the platform needs a common way to describe required production adapters, configure providers safely, health-check them, and report whether the system is ready for production use.

## Decision

Add a production adapter readiness layer with:

- A domain-owned required adapter catalog for persistence, queueing, vector search, LLMs, integration calls, webhooks, scheduling, sandboxed execution, and external secrets.
- Safe production adapter config records that keep raw secret values out of settings and use `secret_ref` instead.
- Health check records and readiness reports that classify required adapters as missing, disabled, unchecked, warning, failing, healthy, degraded, blocked, or ready.
- An application service that allows authenticated reads and limits configuration/health-check writes to configured admin actor IDs.
- Framework-neutral HTTP routes for listing definitions/configs, upserting configs, triggering health checks, and reading readiness.
- In-memory repositories and a deterministic health gateway until concrete production providers are selected.

## Consequences

- Production adapter requirements are now explicit and testable before vendor SDKs or databases are introduced.
- The current implementation remains deterministic and network-free, keeping CI stable.
- Real provider implementations can be added behind the same repository/gateway boundaries without changing the domain policy.
- Nexus still needs concrete production adapters before P1 can be considered complete beyond the readiness foundation.
