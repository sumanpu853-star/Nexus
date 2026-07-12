# 0005: Config Validation Commands

## Status

Accepted

## Context

Architecture checks are now configured in `nexus.config.json`. Users need a way to validate that config and inspect its shape without running the full workspace architecture review.

## Decision

Add CLI modes for config-only validation and JSON Schema output:

- `--validate-config`
- `--print-config-schema`

Keep the default CLI behavior as the full architecture review.

## Consequences

- Configuration changes can be checked quickly.
- CI can validate config before running the full review.
- The schema is available without introducing a third-party validation dependency.
