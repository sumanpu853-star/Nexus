# Nexus

[![CI](https://github.com/sumanpu853-star/Nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/sumanpu853-star/Nexus/actions/workflows/ci.yml)

Nexus is an architecture-first codebase baseline with a small Node.js CLI for reviewing repository architecture guardrails.

## Current State

- Node.js is the first runtime.
- The architecture review CLI is the first production workflow.
- CI runs tests and the architecture review on pushes and pull requests.

## Repository Map

- `docs/ARCHITECTURE.md` describes the intended system boundaries.
- `docs/BOUNDARIES.md` defines dependency direction and ownership rules.
- `docs/ARCHITECTURE_REVIEW.md` provides a repeatable architecture review workflow.
- `docs/REFACTORING_PLAN.md` tracks the step-by-step refactoring workflow.
- `docs/decisions/0001-architecture-baseline.md` records the first architecture decision.
- `docs/decisions/0002-node-cli-first-workflow.md` records the first runtime and workflow decision.
- `docs/decisions/0003-ci-validation-gate.md` records the CI validation decision.
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

Run tests:

```sh
node --test "tests/**/*.test.js"
```

Run the same commands through npm scripts:

```sh
npm test
npm run review:architecture
```

## Next Step

Choose the first user-facing Nexus workflow, then add it through the existing domain, application, interface, and infrastructure boundaries.
