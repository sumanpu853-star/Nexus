# 0008: Product Feature Roadmap

## Status

Accepted

## Context

The original feature list was a short implementation backlog for the architecture-review CLI. The product roadmap now comes from Nexus feature research based on official n8n and Botpress documentation as of July 11, 2026.

## Decision

Use `docs/FEATURES.md` as the source of truth for the product roadmap. Prioritize production safety and security before builder, execution, AI agent, collaboration, and marketplace features.

## Consequences

- Future feature development starts with P0 safety and security work.
- Completed CLI architecture features are treated as foundation work, not the active product backlog.
- Nexus is positioned as an AI-native automation engine combining workflow automation, agent orchestration, RAG, security, and observability.
