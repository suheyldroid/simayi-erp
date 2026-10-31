# Users and permissions impact

## Scope
Add UserProfile, Group, UserGroup, RuleSet, and Owner tables. Extend the existing Users module with nested profile, groups/memberships, groups/rulesets, owners, and permissions modules. Preserve existing identity columns and all Auth source files. Do not add API keys, Django per-object permission tables, or future inventory models.

## Decisions
- Preserve the eleven RuleSet scope names from InvenTree commit `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`, `users/ruleset.py`.
- Preserve additive permissions across groups and `add/delete -> change -> view` normalization.
- Grant new accounts no business permissions. Better Auth's native admin role remains the full-access authority.
- Permit delegated management through the `admin` RuleSet. Delegates cannot manage groups exceeding their own grants, groups carrying administrative grants, or platform administrator accounts. Only native administrators distribute administrative grants.
- Require both a scope permission and user/group ownership for ownership-protected operations. Ownership never grants a scope permission.
- Keep native account credentials, roles, and account status under existing Better Auth administration. Delegated users can read the directory and manage ERP profile/group data within their grants.
- Permit users to edit their own ERP profile. A primary group must be an existing membership. Profile `active` is not account `isActive`.
- Keep current User IDs as TEXT. New relations match the existing identity type; no UUID conversion or Auth table-column change is required.
- Create missing default profiles and user ownership entries idempotently in the profile service, without Auth hooks.

## Change boundary
- `apps/api/prisma/`: additive migration, referential constraints, Owner XOR, membership/ruleset uniqueness, permission inheritance checks.
- `apps/api/src/modules/users/`: central authorization service and nested controllers, static services, DTO models.
- `apps/api/src/plugins/error.ts`: translate serialization conflicts into retryable HTTP conflicts.
- `apps/web/src/features/users/`: self-profile, group and membership management, RuleSet matrix, ownership and effective-permission views.
- User page route and sidebar: allow authenticated users to reach their own profile; hide privileged tabs by effective grants.
- API docs: endpoint and delegation contracts.

## Risk: High
Authorization grants and revocations affect every future business module. Re-read authority for each protected operation. Use serializable transactions for grant, membership, and primary-group changes. Preserve atomic account/session behavior in existing native account endpoints.

## Verification boundary
The operator prohibits all tests. Use only type checking, lint, formatting, source review, and an authorization matrix. Do not apply migrations to the application database. Runtime behavior remains unverified.
