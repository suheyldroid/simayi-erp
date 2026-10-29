# Kullanıcı profili, grup ve yetki

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/users.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ApiKey

Tablo: `api_key`. Extends the default token model provided by djangorestframework.authtoken.

Kaynak: `src/backend/InvenTree/users/models.py:59`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `userId` → `user_id` | `uuid` | Hayır |  |
| `name` → `name` | `varchar(100)` | Hayır | Prisma: "" |
| `expiry` → `expiry` | `date` | Hayır | Django: default_token_expiry |
| `lastSeen` → `last_seen` | `date` | Evet |  |
| `revoked` → `revoked` | `boolean` | Hayır | Prisma: false; Django: False |
| `created` → `created` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı; rest_framework.authtoken.Token.created (abstract parent) |
| `tokenHash` → `token_hash` | `varchar(64)` | Hayır | UNIQUE |
| `tokenPrefix` → `token_prefix` | `varchar(16)` | Hayır |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `userId, revoked`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## RuleSet

Tablo: `rule_set`. A RuleSet is somewhat like a superset of the django permission class, in that in encapsulates a bunch of permissions.

Kaynak: `src/backend/InvenTree/users/models.py:175`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `name` → `name` | `varchar(50)` | Hayır |  |
| `groupId` → `group_id` | `integer` | Hayır |  |
| `canView` → `can_view` | `boolean` | Hayır | Prisma: false; Django: False |
| `canAdd` → `can_add` | `boolean` | Hayır | Prisma: false; Django: False |
| `canChange` → `can_change` | `boolean` | Hayır | Prisma: false; Django: False |
| `canDelete` → `can_delete` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `groupId` → `Group.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, groupId`.
- INDEX: `groupId`.

## Owner

Tablo: `owner`. The Owner class is a proxy for a Group or User instance.

Kaynak: `src/backend/InvenTree/users/models.py:270`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `userId` → `user_id` | `uuid` | Evet | UNIQUE |
| `groupId` → `group_id` | `integer` | Evet | UNIQUE |

**İlişkiler**

- `userId` → `User.id`; 1:1; SQL onDelete `Cascade`; kaynak Django `NEW`.
- `groupId` → `Group.id`; 1:1; SQL onDelete `Cascade`; kaynak Django `NEW`.

**Kısıtlar ve indeksler**

- SQL CHECK: `num_nonnulls("user_id", "group_id") = 1`.

**Sütun olmayan Django alanları**

- `owner`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## UserProfile

Tablo: `user_profile`. Model to store additional user profile information.

Kaynak: `src/backend/InvenTree/users/models.py:463`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `userId` → `user_id` | `uuid` | Hayır | UNIQUE |
| `language` → `language` | `varchar(10)` | Evet |  |
| `theme` → `theme` | `jsonb` | Evet |  |
| `widgets` → `widgets` | `jsonb` | Evet |  |
| `displayname` → `displayname` | `varchar(255)` | Evet |  |
| `position` → `position` | `varchar(255)` | Evet |  |
| `status` → `status` | `varchar(2000)` | Evet |  |
| `location` → `location` | `varchar(2000)` | Evet |  |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `contact` → `contact` | `varchar(255)` | Evet |  |
| `type` → `type` | `varchar(10)` | Hayır | Prisma: "internal"; Django: UserType.INTERNAL |
| `organisation` → `organisation` | `varchar(255)` | Evet |  |
| `primaryGroupId` → `primary_group_id` | `integer` | Evet |  |

**İlişkiler**

- `userId` → `User.id`; 1:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `primaryGroupId` → `Group.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `primaryGroupId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

