# Architecture Review

Use this workflow before adding a feature, moving code, or introducing a dependency.

## 1. Name the Change

Write one sentence that explains the user-visible or operator-visible outcome.

## 2. Locate the Boundary

Identify the primary boundary affected:

- domain rule
- application workflow
- interface entry point
- infrastructure adapter
- cross-cutting concern

## 3. Check Dependency Direction

Confirm the change follows `docs/BOUNDARIES.md`. If it needs an outward dependency, add an interface at the inner layer and an implementation at the edge.

## 4. Decide Test Shape

Pick the smallest test level that proves behavior:

- domain tests for rules and state transitions
- application tests for workflow orchestration
- adapter tests for integration translation
- end-to-end tests only for critical user paths

## 5. Record Decisions

Create an ADR when the change affects long-term direction, including language, framework, persistence, deployment, public API, security model, or data ownership.

## 6. Refactor Safely

Move code in small steps:

- characterize current behavior
- extract or isolate one responsibility
- run validation
- update docs if the boundary changed
