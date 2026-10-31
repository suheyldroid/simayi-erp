# Common and currency API

This guide defines the API contracts and management screens for implementation stages 3 and 4.
The schema follows [DESIGN.md](DESIGN.md), [common](optimized/modules/common.md), and [currency](optimized/modules/currency.md).

## Deployment

From `apps/api`, generate the client and apply the committed migrations:

```bash
bun run db:generate
bun run db:deploy
```

`20261101000000_common_currency` adds eight tables and registered ModelType records. It does not change existing credentials or business grants.
`20261101001000_currency_snapshot_version` adds the backend version counter for concurrent snapshot protection.
User foreign keys retain the existing Better Auth string IDs. No conversion to PostgreSQL UUID occurs.

## Access and structure

- `src/modules/common/` owns settings, units, statuses, and project submodules.
- `src/modules/currency/` owns the rates submodule. `app.ts` mounts only the two parent controllers.
- Controllers use Elysia instances. Services use static methods. Models define request and response schemas with `t`.
- Except for personal settings, endpoints require the corresponding `admin` RuleSet action through `PermissionsService.require`.
- Personal settings use the authenticated account ID. Clients cannot supply another account ID.
- Delegated RuleSet access never grants native Better Auth account, role, or password administration.
- Project access also checks the stored responsible Owner. Lists exclude projects owned by unrelated users or groups for delegates.
- Mutations use serializable transactions. A concurrent transaction conflict returns HTTP 409 through the existing error handler.

## Management screens

Open `/common` for personal preferences, system settings, units, custom statuses, projects, and the read-only ModelType registry.
Open `/currency` for providers, manual rate snapshots, provider refresh, conversion, and the ISO currency catalog.
The sidebar links to both screens. Permission queries control visible actions. The API remains authoritative.
Destructive rate replacement, base changes, and deletion require confirmation. Decimal inputs remain strings throughout the frontend.
The screens use React Query, Zod response validation, and existing UI components. They do not add dependencies.

## Common endpoints

| Path | Methods | Contract |
| --- | --- | --- |
| `/common/model-types` | GET | Registered types only. No public write endpoint. |
| `/common/settings/system` | GET | Supported system keys, stored values, types, and defaults. |
| `/common/settings/system/:key` | PUT, DELETE | `{ value: "..." }`. DELETE restores the default. |
| `/common/settings/user` | GET | Current account preferences. |
| `/common/settings/user/:key` | PUT, DELETE | Current account only. DELETE restores the default. |
| `/common/units/` | GET, POST | Built-in catalog and custom definitions. POST accepts `{ name, symbol, definition }`. |
| `/common/units/:id` | PUT, DELETE | Replace or remove a custom definition. Dependent definitions must remain valid. |
| `/common/units/convert` | POST | `{ amount: "12.500000", from: "kg", to: "g" }`. |
| `/common/statuses/catalog` | GET | Supported workflows, model names, and built-in status values. |
| `/common/statuses/` | GET, POST | Custom status catalog and creation. |
| `/common/statuses/:id` | PUT, DELETE | Replace or delete a custom status. Model, reference class, and key are immutable. |
| `/common/projects/` | GET, POST | Project codes with description, active flag, responsible Owner, and object metadata. |
| `/common/projects/:id` | GET, PATCH, DELETE | Omitted PATCH fields remain unchanged. |

Paginated lists return `{ items, total, limit, offset }`. They accept `limit`, `offset`, and optional `search`.
The default limit is 50. The maximum is 100. The units list also includes `builtins`.

Settings remain strings in storage and JSON. The registry rejects unknown keys and validates booleans, integer bounds, currency codes, and choices.
The initial registry covers company/title, currency/provider/freshness, decimal display limits, project enablement, and four display preferences.
It does not expose arbitrary secret or authentication settings. Additional modules must register their own typed keys before use.

Custom unit definitions support `1`, aliases such as `kg`, and positive factors such as `1000 mm`.
Names and symbols are case-sensitive. The service rejects cycles, collisions, missing targets, and incompatible dimensions.
This is not a Pint replacement. Compound units, temperature offsets, engineering notation, and arbitrary expressions are not supported.

Custom statuses map to built-in logical keys. They do not define new workflow transitions.
Future stock and order services must use `StatusesService.logicalKey` before business decisions.
Those services must also prevent deletion of referenced custom statuses when their business tables are introduced.
ModelType registration alone does not prove that a target record exists.

## Currency endpoints

| Path | Methods | Contract |
| --- | --- | --- |
| `/currency/currencies` | GET | ISO currency catalog from the runtime's `Intl` data. |
| `/currency/backends` | GET, POST | Create `{ name: "manual" or "frankfurter", baseCurrency: "USD" }`. |
| `/currency/backends/:backendId` | PATCH, DELETE | Change `{ baseCurrency }` or delete the backend and its rates. |
| `/currency/backends/:backendId/refresh` | POST | Refresh Frankfurter from its fixed HTTPS endpoint. |
| `/currency/backends/:backendId/rates/` | GET, PUT | Read rates or replace a complete manual snapshot with `{ rates: [{ currency: "EUR", value: "0.920000" }] }`. |
| `/currency/backends/:backendId/rates/:currency` | DELETE | Remove a non-base manual rate. |
| `/currency/convert` | POST | `{ amount: "100.000000", from: "USD", to: "EUR", backend: "manual" }`. |

Create a backend explicitly before its first refresh or manual snapshot.
The provider defaults to `CURRENCY_UPDATE_PLUGIN` when a conversion omits `backend`.
Changing the base deletes the previous snapshot and creates a new base rate of one. Backend deletion cascades its rates.
A snapshot also includes the base rate of one. Duplicate currencies, zero rates, negative rates, and excess precision are rejected.
Frankfurter rates are read-only outside the refresh operation. Refresh failure retains the previous complete snapshot.
Remote requests use a fixed host, a ten-second timeout, response validation, and raw JSON number tokens for exact decimal input.

Amounts and rates cross JSON boundaries as decimal strings. Rates use `Decimal(20,6)`. Amounts use the `Decimal(19,6)` range.
`src/lib/decimal.ts` uses an isolated Prisma Decimal constructor with 80-digit intermediate precision and half-up rounding.
Conversion computes `amount × targetRate ÷ sourceRate` and rounds once to six places. It never converts monetary values to JS Number.
Pricing display settings do not change storage precision or conversion rounding.

`lastUpdate` records snapshot ingestion time, not the provider's market publication date.
Cross-currency conversion rejects snapshots older than `CURRENCY_UPDATE_INTERVAL` hours, which defaults to 24.
Missing rates fail explicitly. There is no implicit fallback to another provider or historical-rate table.

## Automatic refresh

The API starts the currency worker after its dependencies connect and the server starts listening.
The worker polls once per minute after each previous poll completes. Polls never overlap within one process.
`CURRENCY_UPDATE_PLUGIN=frankfurter` enables remote refresh. Selecting `manual` disables automatic remote refresh.
A Frankfurter backend must already exist. Base-only snapshots refresh on the next poll.
Other snapshots refresh one polling period before `CURRENCY_UPDATE_INTERVAL` hours expires.
Setting changes apply on the next poll without a restart.

The worker calls an internal maintenance service, not an unauthenticated route or an impersonated administrator session.
Manual refresh still checks the actor before the network call and again inside the write transaction.
Both paths share provider validation and serializable snapshot replacement.
Refresh records the backend version before its network request and checks that version inside the write transaction.
Base changes and rate mutations increment the version. A concurrent update rejects the older in-flight refresh, without timestamp equality checks.
Failed polls log a redacted error, preserve existing rates, and retry on the next poll.
Shutdown cancels the timer, aborts the provider request, and waits for the active poll before database disconnection.
The timer runs inside the API process, not as a durable queue. It resumes due work after restart.
Multiple instances can fetch concurrently, but serializable writes and snapshot checks prevent conflicting commits.

## Static checks

From `apps/api`:

```bash
bun run check-types
bun run lint
```

From `apps/web`, run `bun run build` and `bun run lint` for frontend compilation and static analysis.

Project policy prohibits automated and manual tests. Schema generation and static checks do not establish runtime correctness.
