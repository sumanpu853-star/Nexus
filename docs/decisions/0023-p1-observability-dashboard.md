# 0023: P1 Observability Dashboard

## Status

Accepted on 2026-07-26.

## Context

The first execution observability slice added aggregate reports for counts, rates, latency, token usage, cost, traces, and node metrics. P1 also calls for dashboard-ready failure-rate, latency, cost, and token reporting surfaces. Those dashboard contracts should remain derived from execution records instead of introducing a separate metrics store too early.

## Decision

Add a dashboard derivation to the workflow execution observability policy. It filters executions by status, trigger source, mode, actor, node, and time window, then returns status breakdowns, trigger and mode counts, latency buckets, top failing nodes, slowest nodes, recent failures, and cost/token usage by status.

Expose the dashboard through the workflow execution application service and the framework-neutral execution HTTP handler at `GET /workflows/:id/executions/dashboard`.

## Consequences

- UI dashboards can consume a stable, immutable contract without duplicating aggregation logic.
- Existing execution records remain the source of truth for reports and dashboard summaries.
- Production metrics exporters can be added later without replacing the domain dashboard contract.
