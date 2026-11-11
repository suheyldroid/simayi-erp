---
name: structure-modules
description: Enforces this project's Elysia controller, static service, generated Prismabox DTO model, optional formatter, and nested-module architecture. Use when creating, changing, or reviewing backend modules under apps/api/src/modules.
---

# Structure Modules

## Source and precedence

- Read https://elysiajs.com/essential/best-practice.md before changing architectural conventions.
- Follow the project rules in `AGENTS.md` when the official guide permits multiple approaches.
- Use `controller.ts` instead of the guide's optional `index.ts` naming.
- Use static service classes even when the guide permits standalone functions.
- Keep `apps/api/src/modules/auth/` thin native Better Auth wiring: plugins, options, `auth.handler`, and the `auth`/`tenant` macros.
- NEVER add an Auth service layer, custom credential or session logic, a custom guard endpoint, or reimplemented auth endpoints.
- NEVER write or run tests, including the examples in the official guide.

## Required structure

```text
apps/api/src/modules/<module>/
├── controller.ts
├── service.ts
├── model.ts
├── formatter.ts        # optional, only when a response needs serialization
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
- Use `auth: true` when the route needs only the verified identity; use `tenant: true` for business routes and pass the resolved `actor`.
- Never select the business tenant from a client-supplied organization ID; `X-Organization-Id` is accepted only when it matches the session's active organization.
- Preserve existing URLs, response contracts, middleware, and security behavior during refactoring.

## Service

- Export services as classes with static methods.
- Use `abstract class` for stateless services.
- NEVER allocate service instances or require constructors.
- Name CRUD methods canonically: `index` lists, `show` returns a single record, `store` creates, `update` modifies, `destroy` deletes.
- Define only the CRUD methods the requested endpoints need; the full set is not required.
- Keep descriptive names for non-CRUD business actions, such as `UsersService.addMember`/`updateMemberRole`.
- NEVER add aliases or keep parallel `get`/`create`/`delete` conventions.
- Keep business logic, database operations, and external integrations here.
- Receive explicit DTOs, headers, identifiers, or other required values.
- Import DTO types from `model.ts` instead of repeating their definitions.
- Use established error handling and preserve transaction boundaries.
- Scope business queries and mutations by the verified `TenantActor` (`userId` plus active `organizationId`) from `src/lib/tenant.ts`; no custom permission, RBAC, dynamic-role, or record-owner authorization layer exists.
- Same-organization members read and mutate every business record. Never add a business authorization gate, `AccessService`, `Principal`, permission scope, or `hasPermission` check. Cross-organization rows stay excluded by an explicit `organizationId` predicate.
- Treat platform `user.role` (`admin`) and native organization `owner`/`admin`/`member` roles as framework authorities only. Platform admin only manages native accounts; organization roles only govern Better Auth member/team management and never restrict ERP records.
- Owner and team fields are business metadata, not access control. When an owner is retained as metadata, only verify that it exists in the same organization; never use it to permit or deny a record.
- Keep member add and role changes in methods such as `UsersService.addMember`/`updateMemberRole`; enforce Better Auth's native role rules (`owner`, `admin`, `member`) and preserve the native adapter transaction boundary. Do not reintroduce dynamic roles or delegated business permissions.
- Build mutation payloads from explicit field allowlists, never unrestricted client-object spreads.
- Call Better Auth's native APIs for users, credentials, and sessions.
- NEVER replace framework-owned authentication with direct credential writes or custom password logic.
- Keep framework configuration entry points thin when external tools require them.

## Model

Generated Prismabox schemas are the source of truth for database-backed DTOs.

- `apps/api/prisma/schema.prisma` generates Prisma Client into `prisma/generated/prisma` and Prismabox TypeBox schemas into `prisma/generated/typebox` (`typeboxImportDependencyName: "elysia"`, `typeboxImportVariableName: "t"`, `useJsonTypes: true`).
- `prisma/generated` is git-ignored build output: NEVER hand-write, edit, or commit generated files, and do not change the generator to work around a DTO problem.
- Import `<Model>Plain` from the generated TypeBox module and use it directly for responses that intentionally return the complete scalar row.
- Use generated `t.Pick`/`t.Omit` for intentional projections and relations; never redeclare persisted scalar fields or keep a drifting field allowlist beside the generated model.
- Build request bodies from generated properties with `t.Pick`/`t.Partial` plus only the HTTP constraints the endpoint needs: lengths, URI format, enums, nullability, and `additionalProperties: false`.
- Compose transport envelopes from generated models plus endpoint-owned fields.
- Derive DTO types with `UnwrapSchema` or the schema's `.static` property; group schemas in an exported `<Module>Model` object.
- Never invent entity schemas or default values for database models. Computed response fields (for example a joined name or a derived `kind`) stay local to the response model; every persisted scalar comes from the generated model.
- Expose only what the requested feature needs: a database model existing is not a reason to add DTOs, endpoints, or UI for it.
- Inspect sensitive fields and relations before returning them; never expose credentials, sessions, tokens, or full relations merely because the generated model contains them.
- Model native Better Auth responses with their real contract and derived variants; never weaken Prisma-backed requiredness or backfill fake values to fit one schema.
- With `useJsonTypes: true`, `Date` fields are ISO strings in responses; serialize every date field, including nullable ones.
- Keep DTOs as schemas, not class instances; keep domain types and framework-derived aliases here; NEVER duplicate schema contracts in interfaces or put business logic, database operations, or HTTP handlers here.
- Keep query, response schema, and formatter aligned: a service select that differs deliberately uses generated `Pick`/`Omit` with a matching response and formatter.

A response built on generated models stays this small:

```ts
import { t } from "elysia";
import { UserPlain } from "../../../prisma/generated/typebox/User";

export const UsersModel = {
  user: UserPlain,
  listResponse: t.Object({
    users: t.Array(UserPlain),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
```

## Formatter

Add `formatter.ts` only when a response needs serialization; never create an empty or scaffold formatter.

- Export a stateless `abstract class <Module>Formatter` with static methods and no instances.
- Keep formatters pure: no database, auth, HTTP, permission, or mutation work.
- Spread the actual Prisma record and convert only what JSON requires, including every nullable date:

```ts
static toUser(user: UsersRecord): UsersModel["user"] {
  return {
    ...user,
    banExpires: user.banExpires ? user.banExpires.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
```

- Keep database nulls as `null`; never substitute `"user"`, `false`, or other invented defaults.
- NEVER rebuild the record field list just to reformat it.
- Keep endpoint-specific transport adapters explicit, such as joining a native role array into a documented comma-separated string, instead of generic normalization.
- Keep DTO schemas and business decisions in `model.ts`/`service.ts`; formatter output must match the declared response schema.
- Call static formatters from services; when passing `Formatter.method` to `map`, it must not depend on `this`.

## Submodules and composition

- Place each submodule inside its owning module.
- Apply the same controller, service, and model boundaries to submodules, with an optional formatter when serialization is needed.
- Consume submodule controllers through `.use(...)` in the owning module's controller.
- Register only top-level module controllers in `app.ts`.
- NEVER register submodule controllers directly in `app.ts`.
- Keep request-dependent Elysia plugins and macros as thin adapters to static service methods.
- Give reusable Elysia plugins stable names for deduplication.
- Keep shared infrastructure in `lib/` and `plugins/` instead of inventing unnecessary modules.

## Static checks

- NEVER add or run tests of any kind: unit, integration, E2E, smoke, browser, or manual.
- NEVER add test files, test commands, test scenarios, or test infrastructure.
- Run only generation and static checks.

```bash
cd apps/api && bun run check-types && bun run lint
```

- Run `bun run db:generate` only when `apps/api/prisma/schema.prisma` changes; it needs no database credentials.
- NEVER modify the Prismabox or Prisma generator configuration casually; any change affects every generated model.
