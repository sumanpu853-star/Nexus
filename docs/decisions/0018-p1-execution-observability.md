# 0018: P1 Execution Observability

## Status

Accepted on 2026-07-26.

## Context

Execution history and node logs made workflow runs inspectable, but P1 also requires traces, metrics, cost tracking, token usage, latency, and failure-rate reporting. These values need stable record shapes before AI agents, RAG, and integration runners can report their runtime behavior.

## Decision

Extend execution and node-run records with token usage, cost, and trace span fields. Roll node-run usage and cost up to the parent execution when recording node results. Add a domain observability policy that derives immutable workflow-level reports with execution counts, status counts, failure and success rates, latency summaries, token totals, cost totals, trace summaries, and per-node metrics. Expose the report through the execution HTTP handler.

## Consequences

- Execution records remain the source of truth for diagnostics and aggregate observability.
- Runner adapters can report usage, cost, and trace spans without owning dashboard logic.
- Future P1 work can add UI dashboards and production trace exporters without changing the core execution record contract.
