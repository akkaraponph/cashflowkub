# Repository instructions

Use this file as the canonical repository guidance. `CLAUDE.md` points here so the two agent entry points stay consistent.

## Domain and architecture

When working in or changing domain behavior or architecture:

- **Always read `docs/knowledgebase/`** first to understand existing domain behavior, database schemas, messaging architecture, and API contracts.
- Read `CONTEXT.md` when it exists.
- Read the relevant decisions in `docs/adr/` when that directory contains ADRs.
- Follow the detailed guidance in `docs/agents/domain.md`.

If `CONTEXT.md` or the relevant ADRs are absent, continue without creating them unless the task resolves a domain term or records an architectural decision.

## Issue tracker

Issues and feature specifications are local Markdown files under `.scratch/`. When a task asks you to create or update an issue or specification, follow `docs/agents/issue-tracker.md`.

## API and schema conventions

- Use `snake_case` for JSON request fields, JSON response fields, and JSONB object keys.
- Keep new API and persisted JSONB fields consistent with the existing contract unless the task explicitly requires a migration or compatibility exception.

## Rules

- **Knowledge Base**:
  - Always read `docs/knowledgebase/` before designing or implementing changes.
  - If any changes are made to domain behavior, database models, architecture, APIs, messaging, or platform configurations, **always update `docs/knowledgebase/`** to reflect those changes.
- **API & Postman Collections**:
  - Whenever any new API endpoints are created or existing APIs are modified, **always add and update** the corresponding requests, parameters, and schemas in the Postman collections and OpenAPI specifications in `docs/postman-collections/`.