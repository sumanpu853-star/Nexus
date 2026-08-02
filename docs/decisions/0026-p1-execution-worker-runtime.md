# ADR 0026: P1 Execution Worker Runtime

## Status

Accepted

## Context

Workflow executions could be queued as records and updated manually through application services, but Nexus needed a worker runtime boundary that can claim queued work, execute planned nodes, record node logs and results, and handle worker failures independently from workflow business failures.

## Decision

Add a queue-backed workflow execution worker runtime with:

- A deterministic workflow node runner adapter that can be replaced by concrete node/provider runners.
- A workflow execution worker service that claims `workflow_execution` jobs from the queue, loads the execution and workflow, runs planned nodes in order, records worker logs, records node results, and completes the queue job.
- Business failure handling where node runner errors mark the execution as failed while completing the processed queue job.
- Worker/infrastructure failure handling where retryable queue errors leave the execution in progress and move the queue job through retry scheduling or dead-lettering.
- A `runNextWorkflowExecution` operation and a bounded `runWorkflowExecutionsUntilIdle` loop.
- A framework-neutral worker HTTP handler for local control and future worker process binding.

## Consequences

- Execution work now has a runtime path from queue job to node run records.
- Deterministic runner behavior keeps CI network-free while preserving a swap point for real HTTP, integration, agent, RAG, and sandbox providers.
- Queue job retries are reserved for worker/runtime failures; workflow business failures are stored on the execution record and treated as successfully processed jobs.
- Concrete worker processes and provider-backed node runners can now be added without changing execution domain records.
