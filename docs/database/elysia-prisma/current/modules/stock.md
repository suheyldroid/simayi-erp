# Stok, depo, izleme ve test

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/stock.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## StockLocationType

Tablo: `stock_stocklocationtype`. A type of stock location like Warehouse, room, shelf, drawer.

Kaynak: `src/backend/InvenTree/stock/models.py:62`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `icon` → `icon` | `varchar(100)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## StockLocation

Tablo: `stock_stocklocation`. Organization tree for StockItem objects.

Kaynak: `src/backend/InvenTree/stock/models.py:126`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `parent_id` → `parent_id` | `integer` | Evet |  |
| `pathstring` → `pathstring` | `varchar(250)` | Hayır |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `custom_icon` → `icon` | `varchar(100)` | Evet |  |
| `owner_id` → `owner_id` | `integer` | Evet |  |
| `structural` → `structural` | `boolean` | Hayır | Django: False |
| `external` → `external` | `boolean` | Hayır | Django: False |
| `location_type_id` → `location_type_id` | `integer` | Evet |  |
| `lft` → `lft` | `integer` | Hayır | django-mptt generated nested-set column |
| `rght` → `rght` | `integer` | Hayır | django-mptt generated nested-set column |
| `tree_id` → `tree_id` | `integer` | Hayır | django-mptt generated nested-set column |
| `level` → `level` | `integer` | Hayır | django-mptt generated nested-set column |

**İlişkiler**

- `parent_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `owner_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `location_type_id` → `StockLocationType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `location_type_id`.
- INDEX: `owner_id`.
- INDEX: `parent_id`.
- INDEX: `tree_id`.
- INDEX: `tree_id, lft`.
- SQL CHECK: `"lft" >= 0`.
- SQL CHECK: `"rght" >= 0`.
- SQL CHECK: `"tree_id" >= 0`.
- SQL CHECK: `"level" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## StockItem

Tablo: `stock_stockitem`. A StockItem object represents a quantity of physical instances of a part.

Kaynak: `src/backend/InvenTree/stock/models.py:426`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `parent_id` → `parent_id` | `integer` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `supplier_part_id` → `supplier_part_id` | `integer` | Evet |  |
| `location_id` → `location_id` | `integer` | Evet |  |
| `packaging` → `packaging` | `varchar(50)` | Evet |  |
| `belongs_to_id` → `belongs_to_id` | `integer` | Evet |  |
| `customer_id` → `customer_id` | `integer` | Evet |  |
| `serial` → `serial` | `varchar(100)` | Evet |  |
| `serial_int` → `serial_int` | `integer` | Hayır | Django: 0 |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `batch` → `batch` | `varchar(100)` | Evet | Django: generate_batch_code |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `build_id` → `build_id` | `integer` | Evet |  |
| `consumed_by_id` → `consumed_by_id` | `integer` | Evet |  |
| `is_building` → `is_building` | `boolean` | Hayır | Django: False |
| `purchase_order_id` → `purchase_order_id` | `integer` | Evet |  |
| `sales_order_id` → `sales_order_id` | `integer` | Evet |  |
| `expiry_date` → `expiry_date` | `date` | Evet |  |
| `stocktake_date` → `stocktake_date` | `date` | Evet |  |
| `stocktake_user_id` → `stocktake_user_id` | `integer` | Evet |  |
| `creation_date` → `creation_date` | `timestamptz(6)` | Evet | Uygulama oluşturma zamanı |
| `delete_on_deplete` → `delete_on_deplete` | `boolean` | Hayır | Django: default_delete_on_deplete |
| `status` → `status` | `integer` | Hayır | Django: StockStatus.OK.value |
| `purchase_price` → `purchase_price` | `numeric(19,6)` | Evet |  |
| `owner_id` → `owner_id` | `integer` | Evet |  |
| `status_custom_key` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `purchase_price_currency` → `purchase_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `parent_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `supplier_part_id` → `SupplierPart.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `location_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `belongs_to_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `customer_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `build_id` → `Build.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `consumed_by_id` → `Build.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `purchase_order_id` → `PurchaseOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `sales_order_id` → `SalesOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `stocktake_user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `owner_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `belongs_to_id`.
- INDEX: `build_id`.
- INDEX: `consumed_by_id`.
- INDEX: `customer_id`.
- INDEX: `location_id`.
- INDEX: `owner_id`.
- INDEX: `parent_id`.
- INDEX: `part_id`.
- INDEX: `purchase_order_id`.
- INDEX: `sales_order_id`.
- INDEX: `stocktake_user_id`.
- INDEX: `supplier_part_id`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- Koşullu benzersizlik `constraints.sql` dosyasında; Prisma şemasının tek başına uygulanması yeterli değildir.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## StockItemTracking

Tablo: `stock_stockitemtracking`. Stock tracking entry - used for tracking history of a particular StockItem.

Kaynak: `src/backend/InvenTree/stock/models.py:3716`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `tracking_type` → `tracking_type` | `integer` | Hayır | Django: StockHistoryCode.LEGACY |
| `item_id` → `item_id` | `integer` | Evet |  |
| `part_id` → `part_id` | `integer` | Evet |  |
| `date` → `date` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `notes` → `notes` | `varchar(512)` | Evet |  |
| `user_id` → `user_id` | `integer` | Evet |  |
| `deltas` → `deltas` | `jsonb` | Evet |  |

**İlişkiler**

- `item_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `item_id`.
- INDEX: `part_id`.
- INDEX: `user_id`.

## StockItemTestResult

Tablo: `stock_stockitemtestresult`. A StockItemTestResult records results of custom tests against individual StockItem objects.

Kaynak: `src/backend/InvenTree/stock/models.py:3801`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `stock_item_id` → `stock_item_id` | `integer` | Hayır |  |
| `template_id` → `template_id` | `integer` | Hayır |  |
| `result` → `result` | `boolean` | Hayır | Django: False |
| `value` → `value` | `varchar(500)` | Hayır |  |
| `attachment` → `attachment` | `varchar(100)` | Evet |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `user_id` → `user_id` | `integer` | Evet |  |
| `test_station` → `test_station` | `varchar(500)` | Hayır |  |
| `started_datetime` → `started_datetime` | `timestamptz(6)` | Evet |  |
| `finished_datetime` → `finished_datetime` | `timestamptz(6)` | Evet |  |
| `date` → `date` | `timestamptz(6)` | Hayır | Django: InvenTree.helpers.current_time |

**İlişkiler**

- `stock_item_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `template_id` → `PartTestTemplate.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `stock_item_id`.
- INDEX: `template_id`.
- INDEX: `user_id`.

