# Satın alma, satış, iade ve transfer

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/order.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## PurchaseOrder

Tablo: `order_purchaseorder`. A PurchaseOrder represents goods shipped inwards from an external supplier.

Kaynak: `src/backend/InvenTree/order/models.py:638`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `reference_int` → `reference_int` | `bigint` | Hayır | Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `start_date` → `start_date` | `date` | Evet |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `creation_date` → `creation_date` | `date` | Evet |  |
| `created_by_id` → `created_by_id` | `integer` | Evet |  |
| `issue_date` → `issue_date` | `date` | Evet |  |
| `updated_at` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsible_id` → `responsible_id` | `integer` | Evet |  |
| `contact_id` → `contact_id` | `integer` | Evet |  |
| `address_id` → `address_id` | `integer` | Evet |  |
| `total_price` → `total_price` | `numeric(19,6)` | Evet |  |
| `order_currency` → `order_currency` | `varchar(3)` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_purchase_order_reference |
| `status` → `status` | `integer` | Hayır | Django: PurchaseOrderStatus.PENDING.value |
| `supplier_id` → `supplier_id` | `integer` | Evet |  |
| `supplier_reference` → `supplier_reference` | `varchar(64)` | Hayır |  |
| `received_by_id` → `received_by_id` | `integer` | Evet |  |
| `complete_date` → `complete_date` | `date` | Evet |  |
| `destination_id` → `destination_id` | `integer` | Evet |  |
| `total_price_currency` → `total_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `status_custom_key` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `created_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `responsible_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `contact_id` → `Contact.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `address_id` → `Address.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `supplier_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `received_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `destination_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `address_id`.
- INDEX: `contact_id`.
- INDEX: `created_by_id`.
- INDEX: `destination_id`.
- INDEX: `project_code_id`.
- INDEX: `received_by_id`.
- INDEX: `responsible_id`.
- INDEX: `supplier_id`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SalesOrder

Tablo: `order_salesorder`. A SalesOrder represents a list of goods shipped outwards to a customer.

Kaynak: `src/backend/InvenTree/order/models.py:1385`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `reference_int` → `reference_int` | `bigint` | Hayır | Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `start_date` → `start_date` | `date` | Evet |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `creation_date` → `creation_date` | `date` | Evet |  |
| `created_by_id` → `created_by_id` | `integer` | Evet |  |
| `issue_date` → `issue_date` | `date` | Evet |  |
| `updated_at` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsible_id` → `responsible_id` | `integer` | Evet |  |
| `contact_id` → `contact_id` | `integer` | Evet |  |
| `address_id` → `address_id` | `integer` | Evet |  |
| `total_price` → `total_price` | `numeric(19,6)` | Evet |  |
| `order_currency` → `order_currency` | `varchar(3)` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_sales_order_reference |
| `customer_id` → `customer_id` | `integer` | Evet |  |
| `status` → `status` | `integer` | Hayır | Django: SalesOrderStatus.PENDING.value |
| `customer_reference` → `customer_reference` | `varchar(64)` | Hayır |  |
| `shipment_date` → `shipment_date` | `date` | Evet |  |
| `shipped_by_id` → `shipped_by_id` | `integer` | Evet |  |
| `total_price_currency` → `total_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `status_custom_key` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `created_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `responsible_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `contact_id` → `Contact.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `address_id` → `Address.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `customer_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `shipped_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `address_id`.
- INDEX: `contact_id`.
- INDEX: `created_by_id`.
- INDEX: `customer_id`.
- INDEX: `project_code_id`.
- INDEX: `responsible_id`.
- INDEX: `shipped_by_id`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## PurchaseOrderLineItem

Tablo: `order_purchaseorderlineitem`. Model for a purchase order line item.

Kaynak: `src/backend/InvenTree/order/models.py:2240`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `part_id` → `part_id` | `integer` | Evet |  |
| `received` → `received` | `numeric(15,5)` | Hayır | Django: 0 |
| `purchase_price` → `purchase_price` | `numeric(19,6)` | Evet |  |
| `build_order_id` → `build_order_id` | `integer` | Evet |  |
| `destination_id` → `destination_id` | `integer` | Evet |  |
| `purchase_price_currency` → `purchase_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `PurchaseOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `part_id` → `SupplierPart.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `build_order_id` → `Build.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `destination_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `build_order_id`.
- INDEX: `destination_id`.
- INDEX: `order_id`.
- INDEX: `part_id`.
- INDEX: `project_code_id`.

## PurchaseOrderExtraLine

Tablo: `order_purchaseorderextraline`. Model for a single ExtraLine in a PurchaseOrder.

Kaynak: `src/backend/InvenTree/order/models.py:2436`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `context` → `context` | `jsonb` | Evet |  |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `PurchaseOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `order_id`.
- INDEX: `project_code_id`.

## SalesOrderLineItem

Tablo: `order_salesorderlineitem`. Model for a single LineItem in a SalesOrder.

Kaynak: `src/backend/InvenTree/order/models.py:2462`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `part_id` → `part_id` | `integer` | Evet |  |
| `sale_price` → `sale_price` | `numeric(19,6)` | Evet |  |
| `shipped` → `shipped` | `numeric(15,5)` | Hayır | Django: 0 |
| `sale_price_currency` → `sale_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `SalesOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `order_id`.
- INDEX: `part_id`.
- INDEX: `project_code_id`.

## SalesOrderShipment

Tablo: `order_salesordershipment`. The SalesOrderShipment model represents a physical shipment made against a SalesOrder.

Kaynak: `src/backend/InvenTree/order/models.py:2617`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `shipment_address_id` → `shipment_address_id` | `integer` | Evet |  |
| `shipment_date` → `shipment_date` | `date` | Evet |  |
| `delivery_date` → `delivery_date` | `date` | Evet |  |
| `checked_by_id` → `checked_by_id` | `integer` | Evet |  |
| `reference` → `reference` | `varchar(100)` | Hayır | Django: 1 |
| `tracking_number` → `tracking_number` | `varchar(100)` | Hayır |  |
| `invoice_number` → `invoice_number` | `varchar(100)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |

**İlişkiler**

- `order_id` → `SalesOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `shipment_address_id` → `Address.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `checked_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `order_id, reference`.
- INDEX: `checked_by_id`.
- INDEX: `order_id`.
- INDEX: `shipment_address_id`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SalesOrderExtraLine

Tablo: `order_salesorderextraline`. Model for a single ExtraLine in a SalesOrder.

Kaynak: `src/backend/InvenTree/order/models.py:3058`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `context` → `context` | `jsonb` | Evet |  |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `SalesOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `order_id`.
- INDEX: `project_code_id`.

## SalesOrderAllocation

Tablo: `order_salesorderallocation`. This model is used to 'allocate' stock items to a SalesOrder. Items that are "allocated" to a SalesOrder are not yet "attached" to the order, but they will be once the order is fulfilled.

Kaynak: `src/backend/InvenTree/order/models.py:3084`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `line_id` → `line_id` | `integer` | Hayır |  |
| `shipment_id` → `shipment_id` | `integer` | Evet |  |
| `item_id` → `item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |

**İlişkiler**

- `line_id` → `SalesOrderLineItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `shipment_id` → `SalesOrderShipment.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `item_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `item_id`.
- INDEX: `line_id`.
- INDEX: `shipment_id`.

## ReturnOrder

Tablo: `order_returnorder`. A ReturnOrder represents goods returned from a customer, e.g. an RMA or warranty.

Kaynak: `src/backend/InvenTree/order/models.py:3229`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `reference_int` → `reference_int` | `bigint` | Hayır | Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `start_date` → `start_date` | `date` | Evet |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `creation_date` → `creation_date` | `date` | Evet |  |
| `created_by_id` → `created_by_id` | `integer` | Evet |  |
| `issue_date` → `issue_date` | `date` | Evet |  |
| `updated_at` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsible_id` → `responsible_id` | `integer` | Evet |  |
| `contact_id` → `contact_id` | `integer` | Evet |  |
| `address_id` → `address_id` | `integer` | Evet |  |
| `total_price` → `total_price` | `numeric(19,6)` | Evet |  |
| `order_currency` → `order_currency` | `varchar(3)` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_return_order_reference |
| `customer_id` → `customer_id` | `integer` | Evet |  |
| `status` → `status` | `integer` | Hayır | Django: ReturnOrderStatus.PENDING.value |
| `customer_reference` → `customer_reference` | `varchar(64)` | Hayır |  |
| `complete_date` → `complete_date` | `date` | Evet |  |
| `total_price_currency` → `total_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `status_custom_key` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `created_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `responsible_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `contact_id` → `Contact.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `address_id` → `Address.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `customer_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `address_id`.
- INDEX: `contact_id`.
- INDEX: `created_by_id`.
- INDEX: `customer_id`.
- INDEX: `project_code_id`.
- INDEX: `responsible_id`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## ReturnOrderLineItem

Tablo: `order_returnorderlineitem`. Model for a single LineItem in a ReturnOrder.

Kaynak: `src/backend/InvenTree/order/models.py:3554`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `item_id` → `item_id` | `integer` | Hayır |  |
| `received_date` → `received_date` | `date` | Evet |  |
| `outcome` → `outcome` | `integer` | Hayır | Django: ReturnOrderLineStatus.PENDING.value |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `outcome_custom_key` → `outcome_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `ReturnOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `item_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `order_id, item_id`.
- INDEX: `item_id`.
- INDEX: `order_id`.
- INDEX: `project_code_id`.
- SQL CHECK: `"outcome" >= 0`.
- SQL CHECK: `"outcome_custom_key" >= 0`.

## ReturnOrderExtraLine

Tablo: `order_returnorderextraline`. Model for a single ExtraLine in a ReturnOrder.

Kaynak: `src/backend/InvenTree/order/models.py:3646`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `context` → `context` | `jsonb` | Evet |  |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `ReturnOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `order_id`.
- INDEX: `project_code_id`.

## TransferOrder

Tablo: `order_transferorder`. A Transfer Order represents a request to transfer stock from one location to another. It provides a place to queue and review changes before execution.

Kaynak: `src/backend/InvenTree/order/models.py:3668`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `reference_int` → `reference_int` | `bigint` | Hayır | Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `start_date` → `start_date` | `date` | Evet |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `creation_date` → `creation_date` | `date` | Evet |  |
| `created_by_id` → `created_by_id` | `integer` | Evet |  |
| `issue_date` → `issue_date` | `date` | Evet |  |
| `updated_at` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsible_id` → `responsible_id` | `integer` | Evet |  |
| `contact_id` → `contact_id` | `integer` | Evet |  |
| `address_id` → `address_id` | `integer` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_transfer_order_reference |
| `status` → `status` | `integer` | Hayır | Django: TransferOrderStatus.PENDING.value |
| `take_from_id` → `take_from_id` | `integer` | Evet |  |
| `destination_id` → `destination_id` | `integer` | Evet |  |
| `consume` → `consume` | `boolean` | Hayır | Django: False |
| `complete_date` → `complete_date` | `date` | Evet |  |
| `status_custom_key` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `created_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `responsible_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `contact_id` → `Contact.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `address_id` → `Address.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `take_from_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `destination_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `address_id`.
- INDEX: `contact_id`.
- INDEX: `created_by_id`.
- INDEX: `destination_id`.
- INDEX: `project_code_id`.
- INDEX: `responsible_id`.
- INDEX: `take_from_id`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## TransferOrderLineItem

Tablo: `order_transferorderlineitem`. Model for a single LineItem in a TransferOrder.

Kaynak: `src/backend/InvenTree/order/models.py:4000`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Django:  |
| `line_int` → `line_int` | `integer` | Hayır | Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır |  |
| `notes` → `notes` | `varchar(500)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `target_date` → `target_date` | `date` | Evet |  |
| `project_code_id` → `project_code_id` | `integer` | Evet |  |
| `order_id` → `order_id` | `integer` | Hayır |  |
| `part_id` → `part_id` | `integer` | Evet |  |
| `transferred` → `transferred` | `numeric(15,5)` | Hayır | Django: 0 |

**İlişkiler**

- `project_code_id` → `ProjectCode.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `order_id` → `TransferOrder.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `order_id`.
- INDEX: `part_id`.
- INDEX: `project_code_id`.

## TransferOrderAllocation

Tablo: `order_transferorderallocation`. This model is used to 'allocate' stock items to a TransferOrder. Items that are "allocated" to a TransferOrder are not yet "attached" to the order, but they will be once the order is fulfilled.

Kaynak: `src/backend/InvenTree/order/models.py:4088`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `line_id` → `line_id` | `integer` | Hayır |  |
| `item_id` → `item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |

**İlişkiler**

- `line_id` → `TransferOrderLineItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `item_id` → `StockItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `item_id`.
- INDEX: `line_id`.

