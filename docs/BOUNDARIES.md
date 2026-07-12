# Boundaries

This document defines where code should live as Nexus grows.

## Dependency Direction

Dependencies should point inward:

1. `src/interfaces` can depend on `src/application`.
2. `src/infrastructure` can depend on `src/application` and stable domain types when needed.
3. `src/application` can depend on `src/domain`.
4. `src/domain` should not depend on the other layers.

When a dependency needs to point outward, introduce a small interface at the inner layer and implement it at the outer layer.

## Directory Ownership

### `src/domain`

Use for business language, invariants, calculations, state transitions, and rules that should outlive framework choices.

Avoid:

- HTTP request objects
- database clients
- environment variables
- logging frameworks
- vendor SDKs

### `src/application`

Use for use cases and workflow coordination. Application code decides what steps happen and in what order, but delegates external effects to interfaces.

Avoid:

- direct SQL or database client calls
- direct network calls to third-party services
- UI formatting

### `src/interfaces`

Use for entry points that translate external input into application requests and application responses into external output.

Examples:

- HTTP controllers
- CLI commands
- background job handlers
- UI-facing adapters

### `src/infrastructure`

Use for concrete integrations and side effects.

Examples:

- database repositories
- filesystem access
- external API clients
- queue producers and consumers
- email or notification providers

## Boundary Review Questions

- Can domain behavior run without a server, database, or network?
- Is each integration wrapped in a small adapter?
- Does application code describe intent rather than protocol details?
- Are framework-specific types kept near the edge?
- Can tests cover the core without booting the whole system?
