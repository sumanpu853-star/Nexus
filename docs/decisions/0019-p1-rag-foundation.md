# 0019: P1 RAG Foundation

## Status

Accepted on 2026-07-26.

## Context

The feature list names RAG as the next P1 priority after execution diagnostics. The LanceDB overwrite audit also requires any future vector adapter to avoid destructive overwrites by default and to expose explicit append, upsert, and replace behavior before RAG ingestion can be considered safe.

## Decision

Add a project-scoped knowledge base domain model with document and chunk records, chunking policy, vector write modes, search result records, and a deterministic reranking policy. Add an application service that authorizes knowledge base reads and writes through project RBAC, ingests documents into chunks, calls an embedding provider boundary, writes vectors through an explicit vector index boundary, and searches with optional reranking. Add framework-neutral knowledge base HTTP routes and a built-in `knowledge_search` node definition.

Use in-memory repositories, a deterministic embedding provider, and an in-memory vector index for the foundation. The vector index supports `append`, `upsert`, and document-scoped `replace`; `upsert` is the ingestion default.

## Consequences

- RAG behavior is testable without network, model, or database dependencies.
- Production vector stores and embedding providers can replace the in-memory adapters without changing the application use cases.
- Destructive vector-table replacement remains out of scope; replacement is explicit and scoped to incoming document ids.
- Future AI agent work can call the knowledge base service through the `knowledge_search` node contract.
