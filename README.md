# Nexus

Nexus is an architecture-first codebase baseline. The repository currently starts with documentation and project hygiene so implementation choices can be made deliberately instead of being baked into an accidental scaffold.

## Current State

- No application runtime has been selected yet.
- No production source code is present yet.
- Architecture review starts from repository boundaries, decision records, and refactoring workflow.

## Repository Map

- `docs/ARCHITECTURE.md` describes the intended system boundaries.
- `docs/BOUNDARIES.md` defines dependency direction and ownership rules.
- `docs/ARCHITECTURE_REVIEW.md` provides a repeatable architecture review workflow.
- `docs/REFACTORING_PLAN.md` tracks the step-by-step refactoring workflow.
- `docs/decisions/0001-architecture-baseline.md` records the first architecture decision.
- `docs/decisions/0002-node-cli-first-workflow.md` records the first runtime and workflow decision.
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

## Next Step

Choose the first user-facing Nexus workflow, then add it through the existing domain, application, interface, and infrastructure boundaries.
