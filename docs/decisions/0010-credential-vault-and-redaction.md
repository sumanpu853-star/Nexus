# 0010: Credential Vault and Redaction Core

## Status

Accepted

## Context

The P0 roadmap requires scoped credentials, encrypted credential storage, credential sharing, external secret provider support, and execution redaction so secrets do not leak through logs or snapshots.

## Decision

Add a framework-neutral credential safety core:

- Domain: credential records, project ownership checks, explicit user sharing, safe credential projections, and secret redaction rules.
- Application: project-scoped credential creation, listing, sharing, and authorized secret resolution.
- Infrastructure: authenticated AES-GCM JSON secret encryption and in-memory credential repositories for local/test composition.

External secret providers are represented by `external_ref` records now, with provider-specific resolution deferred until a concrete integration layer exists.

## Consequences

- Credential secrets are encrypted at rest by default and omitted from outward credential metadata.
- Credential reads are project-scoped and limited to owners, managers, or explicitly shared users.
- Future execution logging can use the redaction core before persisting inputs, outputs, traces, and errors.
- Production persistence and external secret provider adapters remain follow-up P0 work.
