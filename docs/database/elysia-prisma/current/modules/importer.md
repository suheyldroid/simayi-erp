# Veri içe aktarma

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/importer.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## DataImportSession

Tablo: `importer_dataimportsession`. Database model representing a data import session.

Kaynak: `src/backend/InvenTree/importer/models.py:31`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `timestamp` → `timestamp` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `data_file` → `data_file` | `varchar(100)` | Hayır |  |
| `columns` → `columns` | `jsonb` | Evet |  |
| `model_type` → `model_type` | `varchar(100)` | Hayır |  |
| `status` → `status` | `integer` | Hayır | Django: DataImportStatusCode.INITIAL.value |
| `user_id` → `user_id` | `integer` | Evet |  |
| `field_defaults` → `field_defaults` | `jsonb` | Evet |  |
| `field_overrides` → `field_overrides` | `jsonb` | Evet |  |
| `field_filters` → `field_filters` | `jsonb` | Evet |  |
| `update_records` → `update_records` | `boolean` | Hayır | Django: False |
| `completed_row_count_history` → `completed_row_count_history` | `integer` | Evet |  |
| `row_count_history` → `row_count_history` | `integer` | Evet |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `user_id`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"completed_row_count_history" >= 0`.
- SQL CHECK: `"row_count_history" >= 0`.

## DataImportColumnMap

Tablo: `importer_dataimportcolumnmap`. Database model representing a mapping between a file column and serializer field.

Kaynak: `src/backend/InvenTree/importer/models.py:501`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `session_id` → `session_id` | `integer` | Hayır |  |
| `field` → `field` | `varchar(100)` | Hayır |  |
| `column` → `column` | `varchar(100)` | Hayır |  |
| `lookup_field` → `lookup_field` | `varchar(100)` | Evet |  |

**İlişkiler**

- `session_id` → `DataImportSession.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `session_id`.

## DataImportRow

Tablo: `importer_dataimportrow`. Database model representing a single row in a data import session.

Kaynak: `src/backend/InvenTree/importer/models.py:640`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `session_id` → `session_id` | `integer` | Hayır |  |
| `row_index` → `row_index` | `integer` | Hayır | Django: 0 |
| `row_data` → `row_data` | `jsonb` | Evet |  |
| `data` → `data` | `jsonb` | Evet |  |
| `errors` → `errors` | `jsonb` | Evet |  |
| `valid` → `valid` | `boolean` | Hayır | Django: False |
| `complete` → `complete` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `session_id` → `DataImportSession.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `session_id`.
- SQL CHECK: `"row_index" >= 0`.

