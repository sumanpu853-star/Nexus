# 0012: Workflow DAG Validation

## Status

Accepted

## Context

The P0 workflow engine roadmap requires DAG validation before Nexus grows into branching, joins, retries, timeouts, error workflows, and partial execution. Without graph validation, invalid workflows could be stored and later fail unpredictably during execution.

## Decision

Add a domain workflow graph policy that validates workflow nodes and edges before persistence. The policy rejects invalid node and edge shapes, duplicate node IDs, missing edge endpoints, self edges, and cycles. It also exposes topological sorting for future execution ordering.

Workflow creation now runs graph validation before unsafe execution policy checks and before saving a workflow.

## Consequences

- Only valid directed acyclic workflow graphs can be created through the application service.
- Branching and joining DAGs are supported as valid graph shapes.
- Future execution work can build on a validated topological order.
- Retry, timeout, error branch, and partial execution semantics remain follow-up P0 workflow-engine work.
