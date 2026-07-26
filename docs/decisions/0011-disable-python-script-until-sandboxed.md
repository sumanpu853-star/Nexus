# 0011: Disable Python Script Until Sandboxed

## Status

Accepted

## Context

The P0 roadmap requires replacing raw `python_script` execution with a sandboxed code runner or disabling it in production mode. Nexus does not yet have a sandboxed Python runner, so allowing Python workflow nodes would create an unsafe execution path.

## Decision

Disable `python_script` workflow nodes by default through a domain execution safety policy. Workflow creation now validates nodes before persistence and rejects `python_script` unless the application is explicitly configured with a sandboxed `python_script` runner capability.

## Consequences

- Unsafe Python workflows cannot be saved through the current workflow creation service.
- Future sandbox work has a clear integration point: `runnerCapabilities.python_script.sandboxed`.
- The Safe Execution feature remains in progress until a real sandboxed runner and production execution mode are implemented.
