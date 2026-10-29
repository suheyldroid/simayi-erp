# Kullanıcı profili, grup ve yetki

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/users.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ApiToken

Tablo: `users_apitoken`. Extends the default token model provided by djangorestframework.authtoken.

Kaynak: `src/backend/InvenTree/users/models.py:59`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `key` → `key` | `varchar(100)` | Hayır | UNIQUE; Django: default_token |
| `user_id` → `user_id` | `integer` | Hayır |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `expiry` → `expiry` | `date` | Hayır | Django: default_token_expiry |
| `last_seen` → `last_seen` | `date` | Evet |  |
| `revoked` → `revoked` | `boolean` | Hayır | Django: False |
| `created` → `created` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı; rest_framework.authtoken.Token.created (abstract parent) |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `user_id`.

## RuleSet

Tablo: `users_ruleset`. A RuleSet is somewhat like a superset of the django permission class, in that in encapsulates a bunch of permissions.

Kaynak: `src/backend/InvenTree/users/models.py:175`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `name` → `name` | `varchar(50)` | Hayır |  |
| `group_id` → `group_id` | `integer` | Hayır |  |
| `can_view` → `can_view` | `boolean` | Hayır | Django: False |
| `can_add` → `can_add` | `boolean` | Hayır | Django: False |
| `can_change` → `can_change` | `boolean` | Hayır | Django: False |
| `can_delete` → `can_delete` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `group_id` → `Group.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, group_id`.
- INDEX: `group_id`.

## Owner

Tablo: `users_owner`. The Owner class is a proxy for a Group or User instance.

Kaynak: `src/backend/InvenTree/users/models.py:270`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `owner_type_id` → `owner_type_id` | `integer` | Evet |  |
| `owner_id` → `owner_id` | `integer` | Evet |  |

**İlişkiler**

- `owner_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `owner_type_id, owner_id`.
- INDEX: `owner_type_id`.
- SQL CHECK: `"owner_id" >= 0`.

**Sütun olmayan Django alanları**

- `owner`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## UserProfile

Tablo: `users_userprofile`. Model to store additional user profile information.

Kaynak: `src/backend/InvenTree/users/models.py:463`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `user_id` → `user_id` | `integer` | Hayır | UNIQUE |
| `language` → `language` | `varchar(10)` | Evet |  |
| `theme` → `theme` | `jsonb` | Evet |  |
| `widgets` → `widgets` | `jsonb` | Evet |  |
| `displayname` → `displayname` | `varchar(255)` | Evet |  |
| `position` → `position` | `varchar(255)` | Evet |  |
| `status` → `status` | `varchar(2000)` | Evet |  |
| `location` → `location` | `varchar(2000)` | Evet |  |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `contact` → `contact` | `varchar(255)` | Evet |  |
| `type` → `type` | `varchar(10)` | Hayır | Django: UserType.INTERNAL |
| `organisation` → `organisation` | `varchar(255)` | Evet |  |
| `primary_group_id` → `primary_group_id` | `integer` | Evet |  |

**İlişkiler**

- `user_id` → `User.id`; 1:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `primary_group_id` → `Group.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `primary_group_id`.

