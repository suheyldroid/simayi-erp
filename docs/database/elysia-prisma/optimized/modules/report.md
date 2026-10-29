# Rapor ve etiket şablonları

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/report.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ReportTemplate

Tablo: `report_template`. Class representing the ReportTemplate database model.

Kaynak: `src/backend/InvenTree/report/models.py:362`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updatedById` → `updated_by_id` | `uuid` | Evet |  |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `revision` → `revision` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `attachToModel` → `attach_to_model` | `boolean` | Hayır | Prisma: false; Django: False |
| `filenamePattern` → `filename_pattern` | `varchar(100)` | Hayır | Prisma: "output.pdf"; Django: output.pdf |
| `enabled` → `enabled` | `boolean` | Hayır | Prisma: true; Django: True |
| `modelType` → `model_type` | `varchar(100)` | Hayır |  |
| `filters` → `filters` | `varchar(250)` | Hayır | Prisma: "" |
| `template` → `template` | `varchar(100)` | Hayır |  |
| `pageSize` → `page_size` | `varchar(20)` | Hayır | Django: report.helpers.report_page_size_default |
| `landscape` → `landscape` | `boolean` | Hayır | Prisma: false; Django: False |
| `merge` → `merge` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `updatedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, modelType`.
- INDEX: `updatedById`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"revision" >= 0`.

## LabelTemplate

Tablo: `label_template`. Class representing the LabelTemplate database model.

Kaynak: `src/backend/InvenTree/report/models.py:704`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updatedById` → `updated_by_id` | `uuid` | Evet |  |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `revision` → `revision` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `attachToModel` → `attach_to_model` | `boolean` | Hayır | Prisma: false; Django: False |
| `filenamePattern` → `filename_pattern` | `varchar(100)` | Hayır | Prisma: "output.pdf"; Django: output.pdf |
| `enabled` → `enabled` | `boolean` | Hayır | Prisma: true; Django: True |
| `modelType` → `model_type` | `varchar(100)` | Hayır |  |
| `filters` → `filters` | `varchar(250)` | Hayır | Prisma: "" |
| `template` → `template` | `varchar(100)` | Hayır |  |
| `width` → `width` | `double precision` | Hayır | Prisma: 50; Django: 50 |
| `height` → `height` | `double precision` | Hayır | Prisma: 20; Django: 20 |

**İlişkiler**

- `updatedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, modelType`.
- INDEX: `updatedById`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"revision" >= 0`.
- SQL CHECK: `"width" >= 2`.
- SQL CHECK: `"height" >= 2`.

## ReportSnippet

Tablo: `report_snippet`. Report template 'snippet' which can be used to make templates that can then be included in other reports.

Kaynak: `src/backend/InvenTree/report/models.py:854`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `snippet` → `snippet` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## ReportAsset

Tablo: `report_asset`. Asset file for use in report templates.

Kaynak: `src/backend/InvenTree/report/models.py:877`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `asset` → `asset` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

