# 0013: Workflow Node Retry And Timeout Policy

## Status

Accepted

## Context

The P0 workflow engine roadmap requires retries and timeouts before Nexus adds execution records, error branches, and partial execution. If retry and timeout semantics remain implicit, execution runners can drift across adapters and workflows can be saved with values that later cause runaway retries or stalled runs.

## Decision

Add a domain workflow node execution policy that validates and normalizes node-level `timeout_ms` and `retry_policy` values before workflow persistence.

Workflow creation now stores explicit defaults for every node: a 30 second timeout and a no-retry policy. Nodes may opt into bounded retries with supported backoff values, bounded delays, and at most five attempts. Unsupported retry policy fields are rejected so configuration typos fail before persistence.

## Consequences

- Workflow records now carry stable node execution policy values that future runners can consume directly.
- Invalid retry and timeout settings are rejected before any workflow is saved.
- Retry and timeout rules stay in the framework-neutral domain layer.
- Error branch semantics, execution records, and partial execution remain follow-up P0 workflow-engine work.
