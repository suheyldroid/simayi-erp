# SCIM yapılandırması

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/scim.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ScimConfiguration

Tablo: `scim_scimconfiguration`. Simple model for storing config of SCIM.

Kaynak: `src/backend/InvenTree/scim/models.py:21`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `enabled` → `enabled` | `boolean` | Hayır | Django: False |
| `secret_digest` → `secret_digest` | `varchar(64)` | Hayır |  |
| `secret_generated` → `secret_generated` | `timestamptz(6)` | Evet |  |
| `last_used` → `last_used` | `timestamptz(6)` | Evet |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

