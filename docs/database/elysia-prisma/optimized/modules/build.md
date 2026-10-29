# Üretim ve malzeme tahsisi

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/build.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## Build

Tablo: `build`. A Build object organizes the creation of new StockItem objects from other existing StockItem objects.

Kaynak: `src/backend/InvenTree/build/models.py:85`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `referenceInt` → `reference_int` | `bigint` | Hayır | Prisma: 0; Django: 0 |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: generate_next_build_reference |
| `title` → `title` | `varchar(100)` | Hayır | Prisma: "" |
| `parentId` → `parent_id` | `integer` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `salesOrderId` → `sales_order_id` | `integer` | Evet |  |
| `takeFromId` → `take_from_id` | `integer` | Evet |  |
| `external` → `external` | `boolean` | Hayır | Prisma: false; Django: False |
| `destinationId` → `destination_id` | `integer` | Evet |  |
| `quantity` → `quantity` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `completed` → `completed` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `status` → `status` | `integer` | Hayır | Prisma: 10; Django: BuildStatus.PENDING.value |
| `batch` → `batch` | `varchar(100)` | Evet |  |
| `creationDate` → `creation_date` | `date` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `startDate` → `start_date` | `date` | Evet |  |
| `targetDate` → `target_date` | `date` | Evet |  |
| `completionDate` → `completion_date` | `date` | Evet |  |
| `completedById` → `completed_by_id` | `uuid` | Evet |  |
| `issuedById` → `issued_by_id` | `uuid` | Evet |  |
| `responsibleId` → `responsible_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `priority` → `priority` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `statusCustomKey` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `parentId` → `Build.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `salesOrderId` → `SalesOrder.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `takeFromId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `destinationId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `completedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `issuedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `responsibleId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `partId, status`.
- INDEX: `status, targetDate`.
- INDEX: `salesOrderId`.
- INDEX: `destinationId`.
- INDEX: `issuedById`.
- INDEX: `projectCodeId`.
- INDEX: `completedById`.
- INDEX: `responsibleId`.
- INDEX: `parentId`.
- INDEX: `takeFromId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"quantity" >= 1`.
- SQL CHECK: `"completed" >= 0`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"priority" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- SQL CHECK: `"version" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## BuildLine

Tablo: `build_line`. A BuildLine object links a BOMItem to a Build.

Kaynak: `src/backend/InvenTree/build/models.py:2159`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `buildId` → `build_id` | `integer` | Hayır |  |
| `bomItemId` → `bom_item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `consumed` → `consumed` | `numeric(15,5)` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `buildId` → `Build.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `bomItemId` → `BomItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `buildId, bomItemId`.
- INDEX: `bomItemId`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"consumed" >= 0`.

## BuildItem

Tablo: `build_item`. A BuildItem links multiple StockItem objects to a Build.

Kaynak: `src/backend/InvenTree/build/models.py:2279`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `buildLineId` → `build_line_id` | `integer` | Evet |  |
| `stockItemId` → `stock_item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `installIntoId` → `install_into_id` | `integer` | Evet |  |

**İlişkiler**

- `buildLineId` → `BuildLine.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `stockItemId` → `StockItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `installIntoId` → `StockItem.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `buildLineId, stockItemId, installIntoId`.
- INDEX: `installIntoId`.
- INDEX: `stockItemId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.

