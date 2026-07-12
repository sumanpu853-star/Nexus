# 0002: Node CLI First Workflow

## Status

Accepted

## Context

Nexus needed real code, but the product surface is not defined yet. The safest first workflow is one that supports the repository's current purpose: reviewing architecture boundaries as the codebase grows.

## Decision

Use plain Node.js ESM for the first implementation slice. Add a CLI that reviews the workspace against the architecture baseline, with domain checks, application orchestration, a filesystem adapter, and a command-line interface.

## Consequences

- The repository now has executable code without external dependencies.
- The first code path exercises the intended architecture layers.
- Node.js is the initial runtime, but no web framework or persistence model has been selected.
