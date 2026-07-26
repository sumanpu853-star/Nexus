# 0015: Schema-Driven Node Catalog

## Status

Accepted

## Context

The P0 Builder UX roadmap requires schema-driven node forms instead of raw JSON textareas. Nexus also needs a backend contract for `GET /nodes` before a visual builder can render controls, validate parameters, show credential requirements, and understand timeout/retry support consistently.

## Decision

Add a domain node definition policy with built-in definitions for manual trigger, HTTP request, Slack message, AI agent, and Python script nodes. Each definition includes type, label, category, icon, handles, typed parameter fields, credential requirements, execution support metadata, redaction hints, and availability.

Workflow creation now validates node types, parameters, and credential reference shapes against the catalog before persistence. It also applies schema defaults such as HTTP method and empty object fields, so saved workflows have stable form-derived node data.

Add an application node catalog service and a framework-neutral interface handler for `GET /nodes`. A future HTTP server or UI can bind to that handler without moving catalog rules out of the domain/application boundary.

## Consequences

- Builder forms can render from typed backend node definitions instead of raw JSON.
- Invalid node parameters are rejected before workflows are saved.
- Disabled nodes such as `python_script` can remain visible in the catalog with availability metadata while execution safety still blocks unsafe runs.
- Workflow templates and a real UI form renderer remain follow-up Builder UX work.
