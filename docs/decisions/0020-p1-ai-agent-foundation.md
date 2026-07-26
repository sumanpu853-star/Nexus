# 0020: P1 AI Agent Foundation

## Status

Accepted on 2026-07-26.

## Context

The feature list names AI agents as the next P1 priority after RAG. The required shape includes an agent node with tools, memory, model selection, prompt or instruction editing, and tool-call visibility. Those features need a stable, project-scoped contract before production LLM providers, workflow tools, and UI surfaces are added.

## Decision

Add an agent domain policy with records for agents, prompt versions, model selection, memory policy, memory messages, runs, tool permissions, tool calls, and token usage. Add project RBAC permissions for reading, managing, and running agents. Extend the built-in `agent` node definition with model, temperature, memory scope, memory key, and tool-call visibility parameters.

Add an application service for creating agents, updating prompts, listing prompt versions, running agents, storing memory, executing allowed tools, blocking approval-required tools, and recording visible tool-call outcomes. Use in-memory repositories, a deterministic model provider, and an in-memory tool registry as replaceable infrastructure boundaries. Expose the use cases through framework-neutral agent HTTP routes.

## Consequences

- Agent behavior is testable without network or LLM dependencies.
- Production model providers, tool registries, and durable memory stores can replace the deterministic adapters without changing the application service.
- Tool permissions are enforced before tool execution, and blocked calls are visible in run records.
- Human approval workflows remain out of scope until the P2 human-in-loop feature, but approval-required tools are safely blocked today.
