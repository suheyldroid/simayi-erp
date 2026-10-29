# Üretim ve malzeme tahsisi

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/build.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## Build

Tablo: `build_build`. A Build object organizes the creation of new StockItem objects from other existing StockItem objects.

Kaynak: `src/backend/InvenTree/build/models.py:85`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `reference_int` → `reference_int` | `bigint` | Hayır | Django: 0 |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: generate_next_build_reference |
| `title` → `title` | `varchar(100)` | Hayır |  |
| `parent_id` → `parent_id` | `integer` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `sales_order_id` → `sales_order_id` | `integer` | Evet |  |
| `take_from_id` → `take_from_id` | `integer` | Evet |  |
| `external` → `external` | `boolean` | Hayır | Django: False |
| `destination_id` → `destination_id` | `integer` | Evet |  |
| `quantity` → `quantity` | `integer` | Hayır | Django: 1 |
| `completed` → `completed` | `integer` | Hayır | Django: 0 |
| `status` → `status` | `integer` | Hayır | Django: BuildStatus.PENDING.value |
| `batch` → `batch` | `varchar(100)` | Evet |  |
| `creation_date` → `creation_date` | `date` | Hayır | Uygulama oluşturma zamanı |
| `start_date` → `start_date` | `date` | Evet |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `completion_date` → `completion_date` | `date` | Evet |  |
| `completed_by_id` → `completed_by_id` | `integer` | Evet |  |
| `issued_by_id` → `issued_by_id` | `integer` | Evet |  |
| `responsible_id` → `responsible_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `priority` → `priority` | `integer` | Hayır | Django: 0 |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `lft` → `lft` | `integer` | Hayır | django-mptt generated nested-set column |
| `rght` → `rght` | `integer` | Hayır | django-mptt generated nested-set column |
| `tree_id` → `tree_id` | `integer` | Hayır | django-mptt generated nested-set column |
| `level` → `level` | `integer` | Hayır | django-mptt generated nested-set column |
| `status_custom_key` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |

**İlişkiler**

- `parent_id` → `Build.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `sales_order_id` → `SalesOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `take_from_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `destination_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `completed_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `issued_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `responsible_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `completed_by_id`.
- INDEX: `destination_id`.
- INDEX: `issued_by_id`.
- INDEX: `parent_id`.
- INDEX: `part_id`.
- INDEX: `project_code_id`.
- INDEX: `responsible_id`.
- INDEX: `sales_order_id`.
- INDEX: `take_from_id`.
- INDEX: `tree_id`.
- INDEX: `tree_id, lft`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"completed" >= 0`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"priority" >= 0`.
- SQL CHECK: `"lft" >= 0`.
- SQL CHECK: `"rght" >= 0`.
- SQL CHECK: `"tree_id" >= 0`.
- SQL CHECK: `"level" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## BuildLine

Tablo: `build_buildline`. A BuildLine object links a BOMItem to a Build.

Kaynak: `src/backend/InvenTree/build/models.py:2159`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `build_id` → `build_id` | `integer` | Hayır |  |
| `bom_item_id` → `bom_item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `consumed` → `consumed` | `numeric(15,5)` | Hayır | Django: 0 |

**İlişkiler**

- `build_id` → `Build.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `bom_item_id` → `BomItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `build_id, bom_item_id`.
- INDEX: `bom_item_id`.
- INDEX: `build_id`.

## BuildItem

Tablo: `build_builditem`. A BuildItem links multiple StockItem objects to a Build.

Kaynak: `src/backend/InvenTree/build/models.py:2279`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `build_line_id` → `build_line_id` | `integer` | Evet |  |
| `stock_item_id` → `stock_item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `install_into_id` → `install_into_id` | `integer` | Evet |  |

**İlişkiler**

- `build_line_id` → `BuildLine.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `stock_item_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `install_into_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `build_line_id, stock_item_id, install_into_id`.
- INDEX: `build_line_id`.
- INDEX: `install_into_id`.
- INDEX: `stock_item_id`.

