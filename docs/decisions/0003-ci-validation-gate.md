# 0003: CI Validation Gate

## Status

Accepted

## Context

Nexus now has executable code, tests, and an architecture review CLI. Local validation is useful, but future refactors need an automated guardrail on pushes and pull requests.

## Decision

Add a GitHub Actions CI workflow that runs the test suite and architecture review on Node.js 20, 22, and 24 for pushes and pull requests targeting `main`.

## Consequences

- Refactors get fast feedback before they are merged.
- The project validates against the minimum supported Node.js major version and newer runtimes.
- CI remains dependency-light because the project currently uses only Node.js built-ins.
