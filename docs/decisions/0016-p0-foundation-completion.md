# 0016: P0 Foundation Completion

## Status

Accepted

## Context

The P0 roadmap focused on production safety foundations before deeper product features: authentication, project isolation, credential safety, safe execution, workflow correctness, builder schemas, and the LanceDB overwrite blocker. Nexus still does not contain a production HTTP server, worker fleet, vector store, or visual UI, so P0 completion must describe backend and boundary readiness rather than a full production product.

## Decision

Mark P0 foundations complete after adding:

- Auth/session HTTP handlers around the authentication service.
- External secret provider resolution behind the credential vault boundary.
- A sandboxed runner service that refuses unsandboxed code execution.
- Workflow templates and builder form metadata over the node catalog.
- A LanceDB overwrite audit showing no LanceDB/vector-store code exists yet.

Keep the remaining work in P1: production server binding, richer execution history, RAG storage, AI agents, integrations, deployment environments, and observability.

## Consequences

- `docs/FEATURES.md` can move all P0 rows to `Completed`.
- Future P1 work can rely on stable P0 contracts instead of redefining auth, credentials, execution safety, workflow validation, or builder schemas.
- If a vector-store adapter is introduced later, it must include explicit overwrite/upsert behavior and tests before RAG ingestion can be marked complete.
