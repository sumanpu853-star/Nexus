# Feature List

This file is the product source of truth for Nexus feature priority.

## P0: Enforce Architecture Dependency Boundaries

Status: Completed

Nexus should fail the architecture review when an inner layer imports from an outer layer. The first enforced boundary is that `src/domain` must not import from `src/application`, `src/interfaces`, or `src/infrastructure`.

Why first: every future feature depends on keeping the codebase shape healthy.

## P1: Human-Friendly Failure Output

Status: Planned

Failed architecture checks should include concise file-level details and suggested next actions.

## P2: Markdown Report Output

Status: Planned

The CLI should be able to emit a Markdown report for pull request comments and release artifacts.

## P3: Feature Backlog Command

Status: Planned

The CLI should expose the prioritized feature list and identify the next planned feature from the command line.
