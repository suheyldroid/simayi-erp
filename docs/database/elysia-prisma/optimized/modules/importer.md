# Veri içe aktarma

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/importer.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## DataImportSession

Tablo: `data_import_session`. Database model representing a data import session.

Kaynak: `src/backend/InvenTree/importer/models.py:31`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `timestamp` → `timestamp` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `dataFile` → `data_file` | `varchar(100)` | Hayır |  |
| `columns` → `columns` | `jsonb` | Evet |  |
| `modelType` → `model_type` | `varchar(100)` | Hayır |  |
| `status` → `status` | `integer` | Hayır | Prisma: 0; Django: DataImportStatusCode.INITIAL.value |
| `userId` → `user_id` | `uuid` | Evet |  |
| `fieldDefaults` → `field_defaults` | `jsonb` | Evet |  |
| `fieldOverrides` → `field_overrides` | `jsonb` | Evet |  |
| `fieldFilters` → `field_filters` | `jsonb` | Evet |  |
| `updateRecords` → `update_records` | `boolean` | Hayır | Prisma: false; Django: False |
| `completedRowCountHistory` → `completed_row_count_history` | `integer` | Evet |  |
| `rowCountHistory` → `row_count_history` | `integer` | Evet |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `userId`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"completed_row_count_history" >= 0`.
- SQL CHECK: `"row_count_history" >= 0`.

## DataImportColumnMap

Tablo: `data_import_column_map`. Database model representing a mapping between a file column and serializer field.

Kaynak: `src/backend/InvenTree/importer/models.py:501`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `sessionId` → `session_id` | `integer` | Hayır |  |
| `field` → `field` | `varchar(100)` | Hayır |  |
| `column` → `column` | `varchar(100)` | Hayır | Prisma: "" |
| `lookupField` → `lookup_field` | `varchar(100)` | Evet |  |

**İlişkiler**

- `sessionId` → `DataImportSession.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `sessionId`.

## DataImportRow

Tablo: `data_import_row`. Database model representing a single row in a data import session.

Kaynak: `src/backend/InvenTree/importer/models.py:640`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `sessionId` → `session_id` | `integer` | Hayır |  |
| `rowIndex` → `row_index` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `rowData` → `row_data` | `jsonb` | Evet |  |
| `data` → `data` | `jsonb` | Evet |  |
| `errors` → `errors` | `jsonb` | Evet |  |
| `valid` → `valid` | `boolean` | Hayır | Prisma: false; Django: False |
| `complete` → `complete` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `sessionId` → `DataImportSession.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `sessionId, complete, rowIndex`.
- SQL CHECK: `"row_index" >= 0`.

