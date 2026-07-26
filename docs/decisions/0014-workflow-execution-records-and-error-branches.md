# 0014: Workflow Execution Records And Error Branches

## Status

Accepted

## Context

The workflow engine roadmap requires error workflows, partial execution, and durable execution history before Nexus can safely add workers, webhooks, schedules, and AI agent orchestration. Without a shared execution record shape, each runner or interface could invent different status, retry, redaction, and rerun semantics.

## Decision

Add domain policies for workflow error branches, execution planning, and execution records. Workflow edges now persist an explicit `type`, defaulting to `success`, and each source node may define at most one `error` branch. Execution planning follows success edges for the normal path while keeping error branch targets available for failure handling.

Add an application workflow execution service that checks project RBAC, queues full workflow executions, records node run results, redacts snapshots and errors, lists workflow execution history, and queues partial reruns from a failed node. The in-memory infrastructure adapter now stores executions by ID and workflow ID.

## Consequences

- Workflow engine P0 now has validated graph shape, retry/timeout policy, error branch policy, execution records, and partial rerun planning.
- Future workers can consume a stable execution plan and update node run records without owning domain rules.
- Error branch execution remains adapter-driven; this change defines the stored policy and planning contract.
- Rich logs, token/cost metrics, traces, and UI timelines remain follow-up P1 observability work.
