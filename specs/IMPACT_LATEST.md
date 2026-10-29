# Auth impact

## Target
Better Auth configuration, user provisioning, sessions, and the React auth screens.

## Dependents
- `apps/api/src/modules/auth/`: handler, auth macro, `/me`.
- `apps/api/prisma/`: additive migration; preserve existing users and sessions.
- `apps/web/src/features/auth/`: replace simulated sign-in; disable public sign-up and email recovery.
- `apps/web/src/routes/_authenticated/`: require a server-validated session.
- `apps/web/src/features/users/`: replace demo user list with administrator-only creation and password reset.
- Profile/sidebar and sign-out: use the real session; clear query cache on identity changes.
- Remove the demo auth store and fake token assumptions.

## Decisions
The operator chose administrator-created users, administrator password reset without email, and end-to-end frontend integration. Better Auth's official `admin()` and `adminClient()` plugins own user operations. The application has no custom user CRUD endpoints and does not write credentials through Prisma. The official `auth@1.7.7 create-admin` CLI creates the first administrator. Better Auth's `role` field owns administration permissions; an additive migration preserves old administrators and retains legacy flags as data only. The HTTP handler uses Better Auth's transaction context to roll back failed user creation or password-reset/session-revocation operations. Existing identities remain unchanged; new identifiers are UUIDs. Full ERP authorization, organizations, MFA, email verification, and business-model migrations are out of scope.

## Test policy
The operator explicitly prohibited all tests. Test files were removed. Do not write or run tests. See the root `AGENTS.md`.

## Risk: High
Shared identity boundary and existing demo auth behavior. Keep HttpOnly session cookies, validate on the server, prohibit privilege input, and reset passwords plus revoke sessions in one database transaction.
