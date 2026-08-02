# ADR 0027: Phase 4 Agent Workflow Runtime

## Status

Accepted

## Context

The feature list defines Phase 4 as the AI Agent Layer: agent nodes must call tools and workflows, preserve tool permissions, use memory options, support prompt/version history and model selection, and feed cost/token tracking into execution observability. Nexus already had project-scoped agent records, prompt versions, memory records, model providers, tool permissions, and agent HTTP routes, but workflow execution still treated `agent` nodes as deterministic placeholders.

## Decision

Add a persisted-agent workflow node runtime bridge:

- `src/infrastructure/agentWorkflowNodeRunner.js` invokes `agentService.runAgent()` when an `agent` workflow node is bound to an `agent_id`.
- `src/infrastructure/agentWorkflowTools.js` provides reusable knowledge-search and sub-workflow tools that can be allowlisted on agents.
- Workflow node runners can now return an explicit node status and error, allowing blocked or failed agent tool calls to fail the workflow node while preserving output, usage, cost, logs, and traces.
- The `agent` node schema now accepts `agent_id` so workflows can reference prompt-versioned, project-scoped agents.

## Consequences

- Phase 4 is complete at the framework-neutral backend foundation level.
- Agent runs now participate in queue-backed workflow execution and roll token usage, estimated cost, model traces, and tool-call visibility into execution records.
- Production model providers, vector stores, workflow runtime adapters, and external integrations can replace deterministic/local adapters later without changing the agent service contract.
