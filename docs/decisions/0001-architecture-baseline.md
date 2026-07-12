# 0001: Architecture Baseline

## Status

Accepted

## Context

The repository was created before application code existed. Starting with a framework scaffold would force technology and structure decisions before the product shape is clear.

## Decision

Start Nexus with architecture documentation, decision records, and repository hygiene. Defer language, framework, persistence, and deployment choices until the first concrete workflow is known.

## Consequences

- The repository remains flexible while requirements are clarified.
- The next implementation step must choose a runtime deliberately.
- Future refactors should be measured against the boundaries in `docs/ARCHITECTURE.md`.
