# İçerik türleri, etiketler ve Django destek tabloları

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/system.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ModelType

Tablo: `model_type`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `appLabel` → `app_label` | `varchar(100)` | Hayır |  |
| `model` → `model` | `varchar(100)` | Hayır |  |

**Kısıtlar ve indeksler**

- UNIQUE: `appLabel, model`.

## Tag

Tablo: `tag`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `name` → `name` | `varchar(100)` | Hayır | UNIQUE |
| `slug` → `slug` | `varchar(100)` | Hayır | UNIQUE |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## TaggedItem

Tablo: `tagged_item`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `tagId` → `tag_id` | `integer` | Hayır |  |
| `contentTypeId` → `content_type_id` | `integer` | Hayır |  |
| `objectId` → `object_id` | `integer` | Hayır |  |

**İlişkiler**

- `tagId` → `Tag.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `contentTypeId` → `ModelType.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `contentTypeId, objectId, tagId`.
- INDEX: `tagId`.
- INDEX: `objectId`.

