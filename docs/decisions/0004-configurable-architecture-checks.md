# 0004: Configurable Architecture Checks

## Status

Accepted

## Context

The architecture review CLI originally kept its baseline checks in domain code. That made the first implementation simple, but it meant changing review policy required code changes even when the evaluator behavior stayed the same.

## Decision

Move architecture check definitions to `nexus.config.json`. Keep domain code responsible for validating and evaluating check objects, keep filesystem loading at the infrastructure edge, and keep CLI orchestration responsible for wiring config loading into the review workflow.

## Consequences

- Review policy can evolve through configuration changes.
- Domain code is smaller and less tied to this repository's current baseline.
- Invalid or missing config now fails before the workspace review runs.
