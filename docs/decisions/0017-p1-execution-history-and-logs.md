# 0017: P1 Execution History And Logs

## Status

Accepted on 2026-07-26.

## Context

P0 created execution records, node run snapshots, redaction, error branches, and failed-node rerun planning. P1 requires those records to become useful diagnostics: users need history lists, node-level logs, timelines, raw input/output snapshots, and an HTTP boundary for history and reruns.

## Decision

Add a domain execution history policy that derives immutable summaries and timelines from execution records. Extend node runs with validated node log records, and expose application use cases for recording redacted node logs, listing summarized workflow execution history, reading execution detail, reading timelines, and queueing failed-node reruns through a framework-neutral HTTP handler.

## Consequences

- Execution records remain the source of truth; history and timelines are derived views.
- Node log messages and metadata are redacted before persistence.
- The first P1 execution diagnostics slice is complete, while deeper metrics, traces, cost/token usage, and production runner integration remain future P1 work.
