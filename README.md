# Nexus

[![CI](https://github.com/sumanpu853-star/Nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/sumanpu853-star/Nexus/actions/workflows/ci.yml)

Nexus is an architecture-first codebase baseline with a small Node.js CLI for reviewing repository architecture guardrails.

## Current State

- Node.js is the first runtime.
- The architecture review CLI is the first production workflow.
- P0 security implementation has started with framework-neutral auth, signed sessions, RBAC, and project-scoped workflow access.
- P0 credential safety has started with encrypted credential storage, explicit sharing, and reusable secret redaction.
- CI runs tests and the architecture review on pushes and pull requests.

## Repository Map

- `docs/ARCHITECTURE.md` describes the intended system boundaries.
- `docs/BOUNDARIES.md` defines dependency direction and ownership rules.
- `docs/ARCHITECTURE_REVIEW.md` provides a repeatable architecture review workflow.
- `docs/FEATURES.md` is the source of truth for feature priority.
- `docs/REFACTORING_PLAN.md` tracks the step-by-step refactoring workflow.
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

Continue P0 production safety from `docs/FEATURES.md`: safe execution controls and durable persistence adapters.
