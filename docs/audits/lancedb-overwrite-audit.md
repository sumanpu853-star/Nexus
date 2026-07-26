# LanceDB Overwrite Audit

## Status

Completed on 2026-07-26.

## Finding

The repository does not currently contain LanceDB, vector-store, embedding-store, or table overwrite implementation code. The only LanceDB reference is the P0 roadmap item in `docs/FEATURES.md`.

## Decision

Treat the LanceDB overwrite blocker as not applicable to the current codebase. When RAG/vector storage is introduced, its adapter must avoid destructive table replacement by default and must expose explicit append, upsert, and replace modes with tests around each behavior.

## Follow-Up Guardrail

Future RAG work should add a concrete vector-store adapter and architecture check before marking vector ingestion complete.
