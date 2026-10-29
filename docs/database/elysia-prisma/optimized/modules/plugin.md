# Eklenti yapılandırması

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/plugin.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## PluginConfig

Tablo: `plugin_config`. A PluginConfig object holds settings for plugins.

Kaynak: `src/backend/InvenTree/plugin/models.py:22`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `key` → `key` | `varchar(255)` | Hayır | UNIQUE |
| `name` → `name` | `varchar(255)` | Evet |  |
| `packageName` → `package_name` | `varchar(255)` | Evet |  |
| `active` → `active` | `boolean` | Hayır | Prisma: false; Django: False |

**Kısıtlar ve indeksler**

- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## PluginSetting

Tablo: `plugin_setting`. This model represents settings for individual plugins.

Kaynak: `src/backend/InvenTree/plugin/models.py:282`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır | Prisma: "" |
| `pluginId` → `plugin_id` | `integer` | Hayır |  |

**İlişkiler**

- `pluginId` → `PluginConfig.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `pluginId, key`.

## PluginUserSetting

Tablo: `plugin_user_setting`. This model represents user-specific settings for individual plugins.

Kaynak: `src/backend/InvenTree/plugin/models.py:365`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır | Prisma: "" |
| `pluginId` → `plugin_id` | `integer` | Hayır |  |
| `userId` → `user_id` | `uuid` | Hayır |  |

**İlişkiler**

- `pluginId` → `PluginConfig.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `pluginId, userId, key`.
- INDEX: `userId`.

