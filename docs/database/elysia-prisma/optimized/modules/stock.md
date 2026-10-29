# Stok, depo, izleme ve test

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/stock.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## StockLocationType

Tablo: `stock_location_type`. A type of stock location like Warehouse, room, shelf, drawer.

Kaynak: `src/backend/InvenTree/stock/models.py:62`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `icon` → `icon` | `varchar(100)` | Hayır | Prisma: "" |

**Kısıtlar ve indeksler**

- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## StockLocation

Tablo: `stock_location`. Organization tree for StockItem objects.

Kaynak: `src/backend/InvenTree/stock/models.py:126`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `parentId` → `parent_id` | `integer` | Evet |  |
| `pathstring` → `pathstring` | `varchar(250)` | Hayır | Prisma: "" |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `customIcon` → `custom_icon` | `varchar(100)` | Evet |  |
| `ownerId` → `owner_id` | `integer` | Evet |  |
| `structural` → `structural` | `boolean` | Hayır | Prisma: false; Django: False |
| `external` → `external` | `boolean` | Hayır | Prisma: false; Django: False |
| `locationTypeId` → `location_type_id` | `integer` | Evet |  |

**İlişkiler**

- `parentId` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `ownerId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `locationTypeId` → `StockLocationType.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `locationTypeId`.
- INDEX: `parentId`.
- INDEX: `ownerId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## StockItem

Tablo: `stock_item`. A StockItem object represents a quantity of physical instances of a part.

Kaynak: `src/backend/InvenTree/stock/models.py:426`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `parentId` → `parent_id` | `integer` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `supplierPartId` → `supplier_part_id` | `integer` | Evet |  |
| `locationId` → `location_id` | `integer` | Evet |  |
| `packaging` → `packaging` | `varchar(50)` | Evet |  |
| `belongsToId` → `belongs_to_id` | `integer` | Evet |  |
| `customerId` → `customer_id` | `integer` | Evet |  |
| `serial` → `serial` | `varchar(100)` | Evet |  |
| `serialInt` → `serial_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `batch` → `batch` | `varchar(100)` | Evet | Django: generate_batch_code |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `buildId` → `build_id` | `integer` | Evet |  |
| `consumedById` → `consumed_by_id` | `integer` | Evet |  |
| `isBuilding` → `is_building` | `boolean` | Hayır | Prisma: false; Django: False |
| `purchaseOrderId` → `purchase_order_id` | `integer` | Evet |  |
| `salesOrderId` → `sales_order_id` | `integer` | Evet |  |
| `expiryDate` → `expiry_date` | `date` | Evet |  |
| `stocktakeDate` → `stocktake_date` | `date` | Evet |  |
| `stocktakeUserId` → `stocktake_user_id` | `uuid` | Evet |  |
| `creationDate` → `creation_date` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama oluşturma zamanı |
| `deleteOnDeplete` → `delete_on_deplete` | `boolean` | Hayır | Django: default_delete_on_deplete |
| `status` → `status` | `integer` | Hayır | Prisma: 10; Django: StockStatus.OK.value |
| `purchasePrice` → `purchase_price` | `numeric(19,6)` | Evet |  |
| `ownerId` → `owner_id` | `integer` | Evet |  |
| `statusCustomKey` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `purchasePriceCurrency` → `purchase_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `parentId` → `StockItem.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `supplierPartId` → `SupplierPart.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `locationId` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `belongsToId` → `StockItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `customerId` → `Company.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `buildId` → `Build.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `consumedById` → `Build.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `purchaseOrderId` → `PurchaseOrder.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `salesOrderId` → `SalesOrder.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `stocktakeUserId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `ownerId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `partId, locationId, status`.
- INDEX: `locationId, status, id`.
- INDEX: `consumedById`.
- INDEX: `purchaseOrderId`.
- INDEX: `salesOrderId`.
- INDEX: `stocktakeUserId`.
- INDEX: `ownerId`.
- INDEX: `supplierPartId`.
- INDEX: `customerId`.
- INDEX: `expiryDate`.
- INDEX: `batch`.
- INDEX: `serial`.
- INDEX: `parentId`.
- INDEX: `buildId`.
- INDEX: `belongsToId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"purchase_price" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- SQL CHECK: `"version" >= 0`.
- Koşullu benzersizlik `constraints.sql` dosyasında; Prisma şemasının tek başına uygulanması yeterli değildir.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## StockItemTracking

Tablo: `stock_item_tracking`. Stock tracking entry - used for tracking history of a particular StockItem.

Kaynak: `src/backend/InvenTree/stock/models.py:3716`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `trackingType` → `tracking_type` | `integer` | Hayır | Prisma: 0; Django: StockHistoryCode.LEGACY |
| `itemId` → `item_id` | `integer` | Evet |  |
| `partId` → `part_id` | `integer` | Evet |  |
| `date` → `date` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `notes` → `notes` | `varchar(512)` | Evet |  |
| `userId` → `user_id` | `uuid` | Evet |  |
| `deltas` → `deltas` | `jsonb` | Evet |  |

**İlişkiler**

- `itemId` → `StockItem.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `itemId, date`.
- INDEX: `partId, date`.
- INDEX: `userId`.

## StockItemTestResult

Tablo: `stock_item_test_result`. A StockItemTestResult records results of custom tests against individual StockItem objects.

Kaynak: `src/backend/InvenTree/stock/models.py:3801`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `stockItemId` → `stock_item_id` | `integer` | Hayır |  |
| `templateId` → `template_id` | `integer` | Hayır |  |
| `result` → `result` | `boolean` | Hayır | Prisma: false; Django: False |
| `value` → `value` | `varchar(500)` | Hayır | Prisma: "" |
| `attachment` → `attachment` | `varchar(100)` | Evet |  |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `userId` → `user_id` | `uuid` | Evet |  |
| `testStation` → `test_station` | `varchar(500)` | Hayır | Prisma: "" |
| `startedDatetime` → `started_datetime` | `timestamptz(6)` | Evet |  |
| `finishedDatetime` → `finished_datetime` | `timestamptz(6)` | Evet |  |
| `date` → `date` | `timestamptz(6)` | Hayır | Prisma: now(); Django: InvenTree.helpers.current_time |

**İlişkiler**

- `stockItemId` → `StockItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `templateId` → `PartTestTemplate.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `stockItemId, templateId, date`.
- INDEX: `userId`.
- INDEX: `templateId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

