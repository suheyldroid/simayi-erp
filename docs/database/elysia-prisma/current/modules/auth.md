# Kimlik, oturum ve erişim

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/auth.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## User

Tablo: `auth_user`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `password` → `password` | `varchar(128)` | Hayır |  |
| `last_login` → `last_login` | `timestamptz(6)` | Evet |  |
| `is_superuser` → `is_superuser` | `boolean` | Hayır | Django: False |
| `username` → `username` | `varchar(150)` | Hayır | UNIQUE |
| `first_name` → `first_name` | `varchar(150)` | Hayır |  |
| `last_name` → `last_name` | `varchar(150)` | Hayır |  |
| `email` → `email` | `varchar(254)` | Hayır |  |
| `is_staff` → `is_staff` | `boolean` | Hayır | Django: False |
| `is_active` → `is_active` | `boolean` | Hayır | Django: True |
| `date_joined` → `date_joined` | `timestamptz(6)` | Hayır | Django: timezone.now |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Group

Tablo: `auth_group`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `name` → `name` | `varchar(150)` | Hayır | UNIQUE |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Permission

Tablo: `auth_permission`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `name` → `name` | `varchar(255)` | Hayır |  |
| `content_type_id` → `content_type_id` | `integer` | Hayır |  |
| `codename` → `codename` | `varchar(100)` | Hayır |  |

**İlişkiler**

- `content_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `content_type_id, codename`.
- INDEX: `content_type_id`.

## UserGroup

Tablo: `auth_user_groups`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `user_id` → `user_id` | `integer` | Hayır |  |
| `group_id` → `group_id` | `integer` | Hayır |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `group_id` → `Group.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `user_id, group_id`.
- INDEX: `group_id`.
- INDEX: `user_id`.

## UserPermission

Tablo: `auth_user_user_permissions`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `user_id` → `user_id` | `integer` | Hayır |  |
| `permission_id` → `permission_id` | `integer` | Hayır |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `permission_id` → `Permission.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `user_id, permission_id`.
- INDEX: `permission_id`.
- INDEX: `user_id`.

## GroupPermission

Tablo: `auth_group_permissions`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `group_id` → `group_id` | `integer` | Hayır |  |
| `permission_id` → `permission_id` | `integer` | Hayır |  |

**İlişkiler**

- `group_id` → `Group.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `permission_id` → `Permission.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `group_id, permission_id`.
- INDEX: `group_id`.
- INDEX: `permission_id`.

