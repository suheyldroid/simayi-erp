# Eklenti yapılandırması

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/plugin.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## PluginConfig

Tablo: `plugin_pluginconfig`. A PluginConfig object holds settings for plugins.

Kaynak: `src/backend/InvenTree/plugin/models.py:22`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `key` → `key` | `varchar(255)` | Hayır | UNIQUE |
| `name` → `name` | `varchar(255)` | Evet |  |
| `package_name` → `package_name` | `varchar(255)` | Evet |  |
| `active` → `active` | `boolean` | Hayır | Django: False |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## PluginSetting

Tablo: `plugin_pluginsetting`. This model represents settings for individual plugins.

Kaynak: `src/backend/InvenTree/plugin/models.py:282`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır |  |
| `plugin_id` → `plugin_id` | `integer` | Hayır |  |

**İlişkiler**

- `plugin_id` → `PluginConfig.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `plugin_id, key`.
- INDEX: `plugin_id`.

## PluginUserSetting

Tablo: `plugin_pluginusersetting`. This model represents user-specific settings for individual plugins.

Kaynak: `src/backend/InvenTree/plugin/models.py:365`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır |  |
| `plugin_id` → `plugin_id` | `integer` | Hayır |  |
| `user_id` → `user_id` | `integer` | Hayır |  |

**İlişkiler**

- `plugin_id` → `PluginConfig.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `plugin_id, user_id, key`.
- INDEX: `plugin_id`.
- INDEX: `user_id`.

