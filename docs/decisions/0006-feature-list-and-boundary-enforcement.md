# 0006: Feature List and Boundary Enforcement

## Status

Accepted

## Context

Nexus needs a source of truth for feature priority before product work grows. The most important next feature is enforcing the architecture boundaries already documented in the repository.

## Decision

Use `docs/FEATURES.md` as the feature source of truth. Implement the top-priority feature by adding a `forbiddenImports` architecture check kind and configuring it to prevent `src/domain` from importing `src/application`, `src/interfaces`, or `src/infrastructure`.

## Consequences

- Future work has a visible priority list.
- The architecture review now catches dependency-direction regressions.
- Directory targets in workspace snapshots include source-file contents for checks that need to inspect imports.
