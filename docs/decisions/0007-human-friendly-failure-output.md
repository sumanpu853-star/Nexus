# 0007: Human-Friendly Failure Output

## Status

Accepted

## Context

Nexus architecture checks already produce structured failure data, but the text report should be useful without requiring JSON inspection.

## Decision

Render failed checks with concise detail lines when structured failure data is available, including missing expected text and forbidden import violations. Label the recovery action as `Next` so failed checks read as actionable work items.

## Consequences

- CLI users can understand and fix failures faster.
- The text output remains compact for passing checks.
- Future checks should expose structured failure fields when file-level details would help the renderer.
