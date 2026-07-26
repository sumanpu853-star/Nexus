# 0009: Security Core

## Status

Accepted

## Context

The product roadmap starts with P0 production safety and security: real authentication, signed sessions, ownership checks, RBAC, and project/workspace isolation. Nexus does not yet have a web framework or production datastore, so the first implementation should establish the core rules without binding the product to an interface or persistence choice.

## Decision

Implement a framework-neutral security core across the existing layers:

- Domain: user, project, membership, workflow, role, permission, and authorization policy rules.
- Application: registration, login, session authentication, project creation, membership management, and project-scoped workflow access use cases.
- Infrastructure: PBKDF2 password hashing, HMAC-signed JWT-shaped bearer sessions, and in-memory repositories for tests and local composition.

## Consequences

- Future HTTP/API and UI work can use real authentication and project isolation rules instead of inventing edge-only checks.
- Production persistence can replace the in-memory repositories without changing domain policy.
- The security feature remains in progress until durable storage, API/session wiring, credential scoping, and the remaining Phase 1 safety gates are implemented.
