---
name: structure-modules
description: Enforces this project's Elysia controller, static service, DTO model, and nested-module architecture. Use when creating, changing, or reviewing backend modules under apps/api/src/modules.
---

# Structure Modules

## Source and precedence

- Read https://elysiajs.com/essential/best-practice.md before changing architectural conventions.
- Follow the project rules in `AGENTS.md` when the official guide permits multiple approaches.
- Use `controller.ts` instead of the guide's optional `index.ts` naming.
- Use static service classes even when the guide permits standalone functions.
- Preserve the completed Auth module unchanged; NEVER add an Auth service layer.
- Reuse existing Auth exports without editing files under `apps/api/src/modules/auth/`.
- NEVER write or run tests, including the examples in the official guide.

## Required structure

```text
apps/api/src/modules/<module>/
├── controller.ts
├── service.ts
├── model.ts
└── <submodule>/
    ├── controller.ts
    ├── service.ts
    └── model.ts
```

## Controller

- Export an Elysia instance as the controller.
- Define handlers inline so Elysia infers the complete request context.
- Import DTO schemas from the module's `model.ts`.
- Attach request and response schemas through route options.
- Handle routing, cookies, headers, transport validation, and HTTP status codes here.
- Delegate business decisions and external operations to static service methods.
- Pass only required values to services, never the complete Elysia `Context`.
- Pass native `Request` objects only when a framework handler requires them, such as Better Auth.
- Preserve existing URLs, response contracts, middleware, and security behavior during refactoring.

## Service

- Export services as classes with static methods.
- Use `abstract class` for stateless services.
- NEVER allocate service instances or require constructors.
- Keep business logic, database operations, and external integrations here.
- Receive explicit DTOs, headers, identifiers, or other required values.
- Import DTO types from `model.ts` instead of repeating their definitions.
- Use established error handling and preserve transaction boundaries.
- Call Better Auth's native APIs for users, credentials, and sessions.
- NEVER replace framework-owned authentication with direct credential writes or custom password logic.
- Keep framework configuration entry points thin when external tools require them.

## Model

- Define runtime DTO schemas with `t` from `elysia`.
- Derive DTO types with `UnwrapSchema` or the schema's `.static` property.
- Group related schemas in an exported `<Module>Model` object.
- Keep DTOs as schemas, not class instances.
- Keep additional domain types and framework-derived type aliases here.
- NEVER duplicate schema contracts in separate interfaces.
- NEVER put business logic, database operations, or HTTP handlers here.
- Reuse framework-owned schemas instead of duplicating complete Better Auth contracts.

## Submodules and composition

- Place each submodule inside its owning module.
- Apply the same controller, service, and model boundaries to submodules.
- Consume submodule controllers through `.use(...)` in the owning module's controller.
- Register only top-level module controllers in `app.ts`.
- NEVER register submodule controllers directly in `app.ts`.
- Keep request-dependent Elysia plugins and macros as thin adapters to static service methods.
- Give reusable Elysia plugins stable names for deduplication.
- Keep shared infrastructure in `lib/` and `plugins/` instead of inventing unnecessary modules.

## Static checks

- Run only type checks, formatting, and lint checks permitted by `AGENTS.md`.
- NEVER add test files, test commands, test scenarios, or test infrastructure.

```bash
cd apps/api && bun run check-types && bun run lint
```
