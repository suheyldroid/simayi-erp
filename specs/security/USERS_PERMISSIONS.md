# Users authorization source review

> **Historical report.** This document predates the native-organization migration and the flattening of `apps/api/src/modules/users/` into one controller/service/model. Current routes and authority are documented in `apps/api/README.md`. Only the profile and owner source citations below were refreshed for that flattening; the older groups, membership, rule-set, and permission findings remain historical and were not re-audited.
> The ERP profile and owner routes were removed from the API after this review. Their rows stay below as historical findings only; the `UserProfile` and `Owner` database tables remain with their constraints.

## Contract

- Population: all 22 routes declared by the seven controllers under `apps/api/src/modules/users/`.
- Predicate: authenticated server-selected actor and declared domain authority precede every protected effect.
- Variations: own-profile/default provisioning, own membership reads, scoped ownership directory reads, and own permission introspection.
- Exclusions: frozen native Auth handlers, future inventory/order modules, direct database administrators, and frontend visibility checks.
- Enumeration: read all seven controllers and follow their static service calls. Evidence below uses paths relative to `apps/api/src/modules/users/`.
- Status means source enforcement was found. It does not mean runtime verification.

## Authorization matrix

| Route | Authority before effect | Status | Evidence |
| --- | --- | --- | --- |
| GET `/users/` | `admin.view`, active database principal | SATISFIED | `service.ts:28` |
| GET `/users/:id` | Historical: `admin.view`, safe selected fields. Current: `erp_settings.view`, member of the active organization, full `UserPlain` row | SATISFIED (historical) | Historical: `service.ts:59`; current contract: `apps/api/README.md` |
| PATCH `/users/:id` | Platform administrator plus native Better Auth checks | SATISFIED | `controller.ts:37`, `service.ts:109` |
| PATCH `/users/:id/status` | Platform administrator plus native Better Auth checks | SATISFIED | `controller.ts:52`, `service.ts:109` |
| GET `/users/profiles/:userId` | Historical: own profile or `erp_settings.view`; route removed | REMOVED | No route or service method remains |
| PATCH `/users/profiles/:userId` | Historical: own profile or `erp_settings.change`; route removed | REMOVED | No route or service method remains |
| GET `/users/groups/` | `admin.view` | SATISFIED | `groups/service.ts:14` |
| GET `/users/groups/:groupId` | `admin.view` | SATISFIED | `groups/service.ts:40` |
| POST `/users/groups/` | `admin.add`; all new grants denied | SATISFIED | `groups/service.ts:50` |
| PATCH `/users/groups/:groupId` | `admin.change` plus managed-group bounds | SATISFIED | `groups/service.ts:67`, `groups/service.ts:91` |
| DELETE `/users/groups/:groupId` | `admin.delete` plus managed-group bounds | SATISFIED | `groups/service.ts:83`, `groups/service.ts:91` |
| GET `/users/memberships/:userId` | Own memberships or `admin.view` | SATISFIED | `groups/memberships/service.ts` (`groups`) |
| GET `/users/groups/:groupId/members` | `admin.view` | SATISFIED | `groups/memberships/service.ts` (`members`) |
| PUT `/users/groups/:groupId/members/:userId` | `admin.change`, group attenuation, protected user target | SATISFIED | `groups/memberships/service.ts:119` |
| DELETE `/users/groups/:groupId/members/:userId` | Same authority; primary-group cleanup in transaction | SATISFIED | `groups/memberships/service.ts:119` |
| GET `/users/groups/:groupId/rulesets` | `admin.view` | SATISFIED | `groups/rulesets/service.ts:9` |
| PUT `/users/groups/:groupId/rulesets` | `admin.change`, existing and requested grant bounds | SATISFIED | `groups/rulesets/service.ts:34` |
| GET `/users/owners/` | Historical: own user/team filter unless `erp_settings.view`; route removed | REMOVED | No route or service method remains |
| GET `/users/owners/:ownerId` | Historical: same row filter; route removed | REMOVED | No route or service method remains |
| POST `/users/owners/` | Historical: `erp_settings.add`; route removed | REMOVED | No route or service method remains |
| GET `/users/permissions/me` | Active principal, own effective grants only | SATISFIED | `permissions/service.ts` (`effective`, `context`) |
| POST `/users/permissions/check` | Active principal; scope AND existing matching owner when supplied | SATISFIED | `permissions/service.ts:171` |

## Boundary consistency matrix

Predicate: every application path changing a non-null primary group preserves membership validity.

| Writer | Containment | Status |
| --- | --- | --- |
| Profile update/upsert (removed) | Historical; the route and serializable transaction were removed | REMOVED |
| Membership removal | Clear matching primary group before deleting membership in the same serializable transaction | SATISFIED |
| Group deletion | Group foreign key uses `ON DELETE SET NULL`; memberships cascade | SATISFIED |
| Initial defaults | Migration and lazy provisioning leave primary group NULL | SATISFIED |

## Additional source findings

- Permission changes and membership changes re-read authority inside serializable transactions.
- Delegates cannot mutate groups carrying administrative grants or grants exceeding their own effective permissions.
- RuleSet input is normalized into an explicit five-field payload; client IDs and group IDs cannot reach its ORM update.
- Historical, route removed: ERP profile mutation rebuilt its field allowlist; user relation, record ID, JSON preferences, and native privilege fields were not writable.
- Database constraints enforce Owner XOR, unique owner targets, unique memberships/scopes, valid scope names, and permission inheritance.
- Historical, route removed: owner upserts never changed targets; group creation and profile provisioning used explicit single-target owner constructors.
- The combined owner check uses the current database membership, not primary-group preference or profile activity.
- Lists are paginated and capped at 100 rows. Current permission context necessarily reads all memberships for one authenticated actor.
- Scope names and inheritance follow InvenTree commit `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`, `users/ruleset.py` and `RuleSet.save`.

## Verification boundary

Type checking, targeted API lint/format checks, Prisma schema validation, frontend lint, and production frontend build passed.
No tests, browser sessions, API requests, or migration application were performed.
The migration's PostgreSQL execution and concurrent runtime behavior remain unverified.
The helper does not provide automatic row-level security for future business modules. Their services must pass the stored resource's owner ID.
No Auth source files were edited. Native role/account/credential administration remains outside delegated business authority.
