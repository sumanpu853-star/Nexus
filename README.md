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
- `src/` reserves the future production-code boundaries.
- `tests/` reserves the future verification boundaries.

## Next Step

Add or choose the initial application stack, then review the first concrete module boundary before implementation grows.
