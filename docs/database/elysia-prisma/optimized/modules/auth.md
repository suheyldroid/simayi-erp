# Kimlik, oturum ve erişim

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/auth.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## Group

Tablo: `group`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `name` → `name` | `varchar(150)` | Hayır | UNIQUE |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Permission

Tablo: `permission`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `name` → `name` | `varchar(255)` | Hayır |  |
| `contentTypeId` → `content_type_id` | `integer` | Hayır |  |
| `codename` → `codename` | `varchar(100)` | Hayır |  |

**İlişkiler**

- `contentTypeId` → `ModelType.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `contentTypeId, codename`.

## UserGroup

Tablo: `user_group`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `userId` → `user_id` | `uuid` | Hayır |  |
| `groupId` → `group_id` | `integer` | Hayır |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `groupId` → `Group.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `userId, groupId`.
- INDEX: `groupId`.

## UserPermission

Tablo: `user_permission`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `userId` → `user_id` | `uuid` | Hayır |  |
| `permissionId` → `permission_id` | `integer` | Hayır |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `permissionId` → `Permission.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `userId, permissionId`.
- INDEX: `permissionId`.

## GroupPermission

Tablo: `group_permission`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `groupId` → `group_id` | `integer` | Hayır |  |
| `permissionId` → `permission_id` | `integer` | Hayır |  |

**İlişkiler**

- `groupId` → `Group.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `permissionId` → `Permission.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `groupId, permissionId`.
- INDEX: `permissionId`.

## User

Tablo: `auth_user`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `name` → `name` | `text` | Hayır |  |
| `email` → `email` | `text` | Hayır | UNIQUE |
| `emailVerified` → `email_verified` | `boolean` | Hayır | Prisma: false; Django: False |
| `image` → `image` | `text` | Evet |  |
| `createdAt` → `created_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |
| `legacyUserId` → `legacy_user_id` | `integer` | Evet | UNIQUE |
| `legacyUsername` → `legacy_username` | `varchar(150)` | Evet | UNIQUE |
| `firstName` → `first_name` | `varchar(150)` | Hayır | Prisma: ""; Django:  |
| `lastName` → `last_name` | `varchar(150)` | Hayır | Prisma: ""; Django:  |
| `isActive` → `is_active` | `boolean` | Hayır | Prisma: true; Django: True |
| `isStaff` → `is_staff` | `boolean` | Hayır | Prisma: false; Django: False |
| `isSuperuser` → `is_superuser` | `boolean` | Hayır | Prisma: false; Django: False |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Session

Tablo: `auth_session`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `userId` → `user_id` | `uuid` | Hayır |  |
| `token` → `token` | `text` | Hayır | UNIQUE |
| `expiresAt` → `expires_at` | `timestamptz(6)` | Hayır |  |
| `ipAddress` → `ip_address` | `text` | Evet |  |
| `userAgent` → `user_agent` | `text` | Evet |  |
| `createdAt` → `created_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `userId, expiresAt`.
- INDEX: `expiresAt`.

## Account

Tablo: `auth_account`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `userId` → `user_id` | `uuid` | Hayır |  |
| `accountId` → `account_id` | `text` | Hayır |  |
| `providerId` → `provider_id` | `text` | Hayır |  |
| `accessToken` → `access_token` | `text` | Evet |  |
| `refreshToken` → `refresh_token` | `text` | Evet |  |
| `idToken` → `id_token` | `text` | Evet |  |
| `accessTokenExpiresAt` → `access_token_expires_at` | `timestamptz(6)` | Evet |  |
| `refreshTokenExpiresAt` → `refresh_token_expires_at` | `timestamptz(6)` | Evet |  |
| `scope` → `scope` | `text` | Evet |  |
| `password` → `password` | `text` | Evet |  |
| `createdAt` → `created_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `providerId, accountId`.
- INDEX: `userId`.

## Verification

Tablo: `auth_verification`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `identifier` → `identifier` | `text` | Hayır |  |
| `value` → `value` | `text` | Hayır |  |
| `expiresAt` → `expires_at` | `timestamptz(6)` | Hayır |  |
| `createdAt` → `created_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |

**Kısıtlar ve indeksler**

- INDEX: `identifier`.
- INDEX: `expiresAt`.

