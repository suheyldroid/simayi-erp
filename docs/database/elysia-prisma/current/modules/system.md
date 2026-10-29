# İçerik türleri, etiketler ve Django destek tabloları

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/system.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ContentType

Tablo: `django_content_type`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `app_label` → `app_label` | `varchar(100)` | Hayır |  |
| `model` → `model` | `varchar(100)` | Hayır |  |

**Kısıtlar ve indeksler**

- UNIQUE: `app_label, model`.

## Tag

Tablo: `taggit_tag`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `name` → `name` | `varchar(100)` | Hayır | UNIQUE |
| `slug` → `slug` | `varchar(100)` | Hayır | UNIQUE |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## TaggedItem

Tablo: `taggit_taggeditem`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `tag_id` → `tag_id` | `integer` | Hayır |  |
| `content_type_id` → `content_type_id` | `integer` | Hayır |  |
| `object_id` → `object_id` | `integer` | Hayır |  |

**İlişkiler**

- `tag_id` → `Tag.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `content_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `content_type_id, object_id, tag_id`.
- INDEX: `content_type_id`.
- INDEX: `content_type_id, object_id`.
- INDEX: `object_id`.
- INDEX: `tag_id`.

