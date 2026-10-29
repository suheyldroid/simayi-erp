# Rapor ve etiket şablonları

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/report.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ReportTemplate

Tablo: `report_reporttemplate`. Class representing the ReportTemplate database model.

Kaynak: `src/backend/InvenTree/report/models.py:362`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updated_by_id` → `updated_by_id` | `integer` | Evet |  |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `revision` → `revision` | `integer` | Hayır | Django: 1 |
| `attach_to_model` → `attach_to_model` | `boolean` | Hayır | Django: False |
| `filename_pattern` → `filename_pattern` | `varchar(100)` | Hayır | Django: output.pdf |
| `enabled` → `enabled` | `boolean` | Hayır | Django: True |
| `model_type` → `model_type` | `varchar(100)` | Hayır |  |
| `filters` → `filters` | `varchar(250)` | Hayır |  |
| `template` → `template` | `varchar(100)` | Hayır |  |
| `page_size` → `page_size` | `varchar(20)` | Hayır | Django: report.helpers.report_page_size_default |
| `landscape` → `landscape` | `boolean` | Hayır | Django: False |
| `merge` → `merge` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `updated_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, model_type`.
- INDEX: `updated_by_id`.
- SQL CHECK: `"revision" >= 0`.

## LabelTemplate

Tablo: `report_labeltemplate`. Class representing the LabelTemplate database model.

Kaynak: `src/backend/InvenTree/report/models.py:704`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updated_by_id` → `updated_by_id` | `integer` | Evet |  |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `revision` → `revision` | `integer` | Hayır | Django: 1 |
| `attach_to_model` → `attach_to_model` | `boolean` | Hayır | Django: False |
| `filename_pattern` → `filename_pattern` | `varchar(100)` | Hayır | Django: output.pdf |
| `enabled` → `enabled` | `boolean` | Hayır | Django: True |
| `model_type` → `model_type` | `varchar(100)` | Hayır |  |
| `filters` → `filters` | `varchar(250)` | Hayır |  |
| `template` → `template` | `varchar(100)` | Hayır |  |
| `width` → `width` | `double precision` | Hayır | Django: 50 |
| `height` → `height` | `double precision` | Hayır | Django: 20 |

**İlişkiler**

- `updated_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, model_type`.
- INDEX: `updated_by_id`.
- SQL CHECK: `"revision" >= 0`.

## ReportSnippet

Tablo: `report_reportsnippet`. Report template 'snippet' which can be used to make templates that can then be included in other reports.

Kaynak: `src/backend/InvenTree/report/models.py:854`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `snippet` → `snippet` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## ReportAsset

Tablo: `report_reportasset`. Asset file for use in report templates.

Kaynak: `src/backend/InvenTree/report/models.py:877`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `asset` → `asset` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

