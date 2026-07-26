# Nexus

[![CI](https://github.com/sumanpu853-star/Nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/sumanpu853-star/Nexus/actions/workflows/ci.yml)

Nexus is an architecture-first codebase baseline with a small Node.js CLI for reviewing repository architecture guardrails.

## Current State

- Node.js is the first runtime.
- The architecture review CLI is the first production workflow.
- P0 security foundation covers framework-neutral auth, signed sessions, RBAC, project-scoped access, and auth/session HTTP handlers.
- P0 credential safety covers encrypted storage, explicit sharing, reusable redaction, and external secret provider resolution.
- P0 safe execution covers disabled unsafe nodes plus an explicit sandboxed runner boundary for code execution.
- P0 workflow engine foundation covers DAG validation, branching/joins, retry/timeout defaults, error branches, execution records, and partial rerun planning.
- P0 builder UX foundation covers schema-driven node definitions, workflow node parameter validation, templates, node forms, and catalog handlers.
- P1 execution diagnostics now include summarized execution lists, node-level logs, diagnostic timelines, token/cost rollups, trace spans, observability reports, detail routes, and failed-node rerun routes.
- P1 RAG foundation covers project-scoped knowledge bases, document ingestion, chunking, deterministic embedding boundaries, vector search, reranking hooks, and a knowledge search node definition.
- P1 AI agent foundation covers project-scoped agents, model selection, prompt versions, memory scopes, tool permissions, deterministic model adapters, and visible tool-call records.
- The LanceDB overwrite blocker was audited and is not applicable until vector-store code is introduced.
- CI runs tests and the architecture review on pushes and pull requests.

## Repository Map

- `docs/ARCHITECTURE.md` describes the intended system boundaries.
- `docs/BOUNDARIES.md` defines dependency direction and ownership rules.
- `docs/ARCHITECTURE_REVIEW.md` provides a repeatable architecture review workflow.
- `docs/FEATURES.md` is the source of truth for feature priority.
- `docs/REFACTORING_PLAN.md` tracks the step-by-step refactoring workflow.
- `docs/audits/lancedb-overwrite-audit.md` records the LanceDB overwrite audit.
- `docs/decisions/0001-architecture-baseline.md` records the first architecture decision.
- `docs/decisions/0002-node-cli-first-workflow.md` records the first runtime and workflow decision.
- `docs/decisions/0003-ci-validation-gate.md` records the CI validation decision.
- `docs/decisions/0004-configurable-architecture-checks.md` records the configurable checks decision.
- `docs/decisions/0005-config-validation-commands.md` records the config validation command decision.
- `docs/decisions/0006-feature-list-and-boundary-enforcement.md` records the feature-list and boundary-enforcement decision.
- `docs/decisions/0007-human-friendly-failure-output.md` records the failure-output decision.
- `docs/decisions/0008-product-feature-roadmap.md` records the product roadmap decision.
- `docs/decisions/0009-security-core.md` records the first P0 security implementation decision.
- `docs/decisions/0010-credential-vault-and-redaction.md` records the credential safety decision.
- `docs/decisions/0011-disable-python-script-until-sandboxed.md` records the Python execution safety decision.
- `docs/decisions/0012-workflow-dag-validation.md` records the workflow graph validation decision.
- `docs/decisions/0013-workflow-node-retry-timeout-policy.md` records the node execution policy decision.
- `docs/decisions/0014-workflow-execution-records-and-error-branches.md` records the execution planning decision.
- `docs/decisions/0015-schema-driven-node-catalog.md` records the node catalog decision.
- `docs/decisions/0016-p0-foundation-completion.md` records the P0 completion boundary.
- `docs/decisions/0017-p1-execution-history-and-logs.md` records the first P1 execution diagnostics decision.
- `docs/decisions/0018-p1-execution-observability.md` records the token, cost, trace, and metrics decision.
- `docs/decisions/0019-p1-rag-foundation.md` records the RAG knowledge base and vector adapter decision.
- `docs/decisions/0020-p1-ai-agent-foundation.md` records the agent, memory, model, and tool-permission decision.
- `nexus.config.json` defines the architecture checks used by the CLI and CI.
- `src/` reserves the future production-code boundaries.
- `tests/` reserves the future verification boundaries.

## Commands

Run the architecture review CLI:

```sh
node src/interfaces/cli.js
```

Print the same report as JSON:

```sh
node src/interfaces/cli.js --json
```

Use a custom architecture config:

```sh
node src/interfaces/cli.js --config nexus.config.json
```

Validate only the config:

```sh
node src/interfaces/cli.js --validate-config
```

Print the config JSON Schema:

```sh
node src/interfaces/cli.js --print-config-schema
```

Run tests:

```sh
npm test
```

Run the same commands through npm scripts:

```sh
npm test
npm run validate:config
npm run review:architecture
npm run print:config-schema
```

## Next Step

Continue P1 from `docs/FEATURES.md`: move to integrations, deployment, and remaining observability dashboards.
