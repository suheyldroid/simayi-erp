# Satın alma, satış, iade ve transfer

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/order.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## PurchaseOrder

Tablo: `purchase_order`. A PurchaseOrder represents goods shipped inwards from an external supplier.

Kaynak: `src/backend/InvenTree/order/models.py:638`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `referenceInt` → `reference_int` | `bigint` | Hayır | Prisma: 0; Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `startDate` → `start_date` | `date` | Evet |  |
| `targetDate` → `target_date` | `date` | Evet |  |
| `creationDate` → `creation_date` | `date` | Evet |  |
| `createdById` → `created_by_id` | `uuid` | Evet |  |
| `issueDate` → `issue_date` | `date` | Evet |  |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsibleId` → `responsible_id` | `integer` | Evet |  |
| `contactId` → `contact_id` | `integer` | Evet |  |
| `addressId` → `address_id` | `integer` | Evet |  |
| `totalPrice` → `total_price` | `numeric(19,6)` | Evet |  |
| `orderCurrency` → `order_currency` | `varchar(3)` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_purchase_order_reference |
| `status` → `status` | `integer` | Hayır | Prisma: 10; Django: PurchaseOrderStatus.PENDING.value |
| `supplierId` → `supplier_id` | `integer` | Evet |  |
| `supplierReference` → `supplier_reference` | `varchar(64)` | Hayır | Prisma: "" |
| `receivedById` → `received_by_id` | `uuid` | Evet |  |
| `completeDate` → `complete_date` | `date` | Evet |  |
| `destinationId` → `destination_id` | `integer` | Evet |  |
| `totalPriceCurrency` → `total_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `statusCustomKey` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `createdById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `responsibleId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `contactId` → `Contact.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `addressId` → `Address.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `supplierId` → `Company.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `receivedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `destinationId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `supplierId, status`.
- INDEX: `status, targetDate`.
- INDEX: `addressId`.
- INDEX: `createdById`.
- INDEX: `projectCodeId`.
- INDEX: `destinationId`.
- INDEX: `responsibleId`.
- INDEX: `contactId`.
- INDEX: `receivedById`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"total_price" >= 0`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- SQL CHECK: `"version" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SalesOrder

Tablo: `sales_order`. A SalesOrder represents a list of goods shipped outwards to a customer.

Kaynak: `src/backend/InvenTree/order/models.py:1385`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `referenceInt` → `reference_int` | `bigint` | Hayır | Prisma: 0; Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `startDate` → `start_date` | `date` | Evet |  |
| `targetDate` → `target_date` | `date` | Evet |  |
| `creationDate` → `creation_date` | `date` | Evet |  |
| `createdById` → `created_by_id` | `uuid` | Evet |  |
| `issueDate` → `issue_date` | `date` | Evet |  |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsibleId` → `responsible_id` | `integer` | Evet |  |
| `contactId` → `contact_id` | `integer` | Evet |  |
| `addressId` → `address_id` | `integer` | Evet |  |
| `totalPrice` → `total_price` | `numeric(19,6)` | Evet |  |
| `orderCurrency` → `order_currency` | `varchar(3)` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_sales_order_reference |
| `customerId` → `customer_id` | `integer` | Evet |  |
| `status` → `status` | `integer` | Hayır | Prisma: 10; Django: SalesOrderStatus.PENDING.value |
| `customerReference` → `customer_reference` | `varchar(64)` | Hayır | Prisma: "" |
| `shipmentDate` → `shipment_date` | `date` | Evet |  |
| `shippedById` → `shipped_by_id` | `uuid` | Evet |  |
| `totalPriceCurrency` → `total_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `statusCustomKey` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `createdById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `responsibleId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `contactId` → `Contact.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `addressId` → `Address.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `customerId` → `Company.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `shippedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `status, targetDate`.
- INDEX: `customerId, status`.
- INDEX: `shippedById`.
- INDEX: `addressId`.
- INDEX: `createdById`.
- INDEX: `projectCodeId`.
- INDEX: `responsibleId`.
- INDEX: `contactId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"total_price" >= 0`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- SQL CHECK: `"version" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## PurchaseOrderLineItem

Tablo: `purchase_order_line_item`. Model for a purchase order line item.

Kaynak: `src/backend/InvenTree/order/models.py:2240`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `partId` → `part_id` | `integer` | Evet |  |
| `received` → `received` | `numeric(15,5)` | Hayır | Prisma: 0; Django: 0 |
| `purchasePrice` → `purchase_price` | `numeric(19,6)` | Evet |  |
| `buildOrderId` → `build_order_id` | `integer` | Evet |  |
| `destinationId` → `destination_id` | `integer` | Evet |  |
| `purchasePriceCurrency` → `purchase_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `PurchaseOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `partId` → `SupplierPart.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `buildOrderId` → `Build.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `destinationId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `partId`.
- INDEX: `destinationId`.
- INDEX: `projectCodeId`.
- INDEX: `buildOrderId`.
- INDEX: `orderId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.
- SQL CHECK: `"purchase_price" >= 0`.

## PurchaseOrderExtraLine

Tablo: `purchase_order_extra_line`. Model for a single ExtraLine in a PurchaseOrder.

Kaynak: `src/backend/InvenTree/order/models.py:2436`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `context` → `context` | `jsonb` | Evet |  |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `PurchaseOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `orderId`.
- INDEX: `projectCodeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.

## SalesOrderLineItem

Tablo: `sales_order_line_item`. Model for a single LineItem in a SalesOrder.

Kaynak: `src/backend/InvenTree/order/models.py:2462`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `partId` → `part_id` | `integer` | Evet |  |
| `salePrice` → `sale_price` | `numeric(19,6)` | Evet |  |
| `shipped` → `shipped` | `numeric(15,5)` | Hayır | Prisma: 0; Django: 0 |
| `salePriceCurrency` → `sale_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `SalesOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `partId` → `Part.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `orderId`.
- INDEX: `partId`.
- INDEX: `projectCodeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.
- SQL CHECK: `"sale_price" >= 0`.
- SQL CHECK: `"shipped" >= 0`.

## SalesOrderShipment

Tablo: `sales_order_shipment`. The SalesOrderShipment model represents a physical shipment made against a SalesOrder.

Kaynak: `src/backend/InvenTree/order/models.py:2617`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `shipmentAddressId` → `shipment_address_id` | `integer` | Evet |  |
| `shipmentDate` → `shipment_date` | `date` | Evet |  |
| `deliveryDate` → `delivery_date` | `date` | Evet |  |
| `checkedById` → `checked_by_id` | `uuid` | Evet |  |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "1"; Django: 1 |
| `trackingNumber` → `tracking_number` | `varchar(100)` | Hayır | Prisma: "" |
| `invoiceNumber` → `invoice_number` | `varchar(100)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |

**İlişkiler**

- `orderId` → `SalesOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `shipmentAddressId` → `Address.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `checkedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `orderId, reference`.
- INDEX: `checkedById`.
- INDEX: `shipmentAddressId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SalesOrderExtraLine

Tablo: `sales_order_extra_line`. Model for a single ExtraLine in a SalesOrder.

Kaynak: `src/backend/InvenTree/order/models.py:3058`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `context` → `context` | `jsonb` | Evet |  |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `SalesOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `orderId`.
- INDEX: `projectCodeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.

## SalesOrderAllocation

Tablo: `sales_order_allocation`. This model is used to 'allocate' stock items to a SalesOrder. Items that are "allocated" to a SalesOrder are not yet "attached" to the order, but they will be once the order is fulfilled.

Kaynak: `src/backend/InvenTree/order/models.py:3084`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `lineId` → `line_id` | `integer` | Hayır |  |
| `shipmentId` → `shipment_id` | `integer` | Evet |  |
| `itemId` → `item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |

**İlişkiler**

- `lineId` → `SalesOrderLineItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `shipmentId` → `SalesOrderShipment.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `itemId` → `StockItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `itemId`.
- INDEX: `lineId`.
- INDEX: `shipmentId`.
- SQL CHECK: `"quantity" >= 0`.

## ReturnOrder

Tablo: `return_order`. A ReturnOrder represents goods returned from a customer, e.g. an RMA or warranty.

Kaynak: `src/backend/InvenTree/order/models.py:3229`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `referenceInt` → `reference_int` | `bigint` | Hayır | Prisma: 0; Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `startDate` → `start_date` | `date` | Evet |  |
| `targetDate` → `target_date` | `date` | Evet |  |
| `creationDate` → `creation_date` | `date` | Evet |  |
| `createdById` → `created_by_id` | `uuid` | Evet |  |
| `issueDate` → `issue_date` | `date` | Evet |  |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsibleId` → `responsible_id` | `integer` | Evet |  |
| `contactId` → `contact_id` | `integer` | Evet |  |
| `addressId` → `address_id` | `integer` | Evet |  |
| `totalPrice` → `total_price` | `numeric(19,6)` | Evet |  |
| `orderCurrency` → `order_currency` | `varchar(3)` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_return_order_reference |
| `customerId` → `customer_id` | `integer` | Evet |  |
| `status` → `status` | `integer` | Hayır | Prisma: 10; Django: ReturnOrderStatus.PENDING.value |
| `customerReference` → `customer_reference` | `varchar(64)` | Hayır | Prisma: "" |
| `completeDate` → `complete_date` | `date` | Evet |  |
| `totalPriceCurrency` → `total_price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `statusCustomKey` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `createdById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `responsibleId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `contactId` → `Contact.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `addressId` → `Address.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `customerId` → `Company.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `customerId, status`.
- INDEX: `addressId`.
- INDEX: `createdById`.
- INDEX: `projectCodeId`.
- INDEX: `responsibleId`.
- INDEX: `contactId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"total_price" >= 0`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- SQL CHECK: `"version" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## ReturnOrderLineItem

Tablo: `return_order_line_item`. Model for a single LineItem in a ReturnOrder.

Kaynak: `src/backend/InvenTree/order/models.py:3554`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `itemId` → `item_id` | `integer` | Hayır |  |
| `receivedDate` → `received_date` | `date` | Evet |  |
| `outcome` → `outcome` | `integer` | Hayır | Prisma: 10; Django: ReturnOrderLineStatus.PENDING.value |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `outcomeCustomKey` → `outcome_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `ReturnOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `itemId` → `StockItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `orderId, itemId`.
- INDEX: `itemId`.
- INDEX: `projectCodeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.
- SQL CHECK: `"outcome" >= 0`.
- SQL CHECK: `"price" >= 0`.
- SQL CHECK: `"outcome_custom_key" >= 0`.

## ReturnOrderExtraLine

Tablo: `return_order_extra_line`. Model for a single ExtraLine in a ReturnOrder.

Kaynak: `src/backend/InvenTree/order/models.py:3646`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `context` → `context` | `jsonb` | Evet |  |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `ReturnOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `orderId`.
- INDEX: `projectCodeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.

## TransferOrder

Tablo: `transfer_order`. A Transfer Order represents a request to transfer stock from one location to another. It provides a place to queue and review changes before execution.

Kaynak: `src/backend/InvenTree/order/models.py:3668`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `referenceInt` → `reference_int` | `bigint` | Hayır | Prisma: 0; Django: 0 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `startDate` → `start_date` | `date` | Evet |  |
| `targetDate` → `target_date` | `date` | Evet |  |
| `creationDate` → `creation_date` | `date` | Evet |  |
| `createdById` → `created_by_id` | `uuid` | Evet |  |
| `issueDate` → `issue_date` | `date` | Evet |  |
| `updatedAt` → `updated_at` | `timestamptz(6)` | Evet |  |
| `responsibleId` → `responsible_id` | `integer` | Evet |  |
| `contactId` → `contact_id` | `integer` | Evet |  |
| `addressId` → `address_id` | `integer` | Evet |  |
| `reference` → `reference` | `varchar(64)` | Hayır | UNIQUE; Django: order.validators.generate_next_transfer_order_reference |
| `status` → `status` | `integer` | Hayır | Prisma: 10; Django: TransferOrderStatus.PENDING.value |
| `takeFromId` → `take_from_id` | `integer` | Evet |  |
| `destinationId` → `destination_id` | `integer` | Evet |  |
| `consume` → `consume` | `boolean` | Hayır | Prisma: false; Django: False |
| `completeDate` → `complete_date` | `date` | Evet |  |
| `statusCustomKey` → `status_custom_key` | `integer` | Evet | Django: None; generic/states/fields.py contribute_to_class companion column |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `createdById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `responsibleId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `contactId` → `Contact.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `addressId` → `Address.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `takeFromId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `destinationId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `status, targetDate`.
- INDEX: `addressId`.
- INDEX: `createdById`.
- INDEX: `projectCodeId`.
- INDEX: `destinationId`.
- INDEX: `responsibleId`.
- INDEX: `contactId`.
- INDEX: `takeFromId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"status" >= 0`.
- SQL CHECK: `"status_custom_key" >= 0`.
- SQL CHECK: `"version" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## TransferOrderLineItem

Tablo: `transfer_order_line_item`. Model for a single LineItem in a TransferOrder.

Kaynak: `src/backend/InvenTree/order/models.py:4000`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `discount` → `discount` | `numeric(5,2)` | Hayır | Prisma: 0; Django: 0 |
| `line` → `line` | `varchar(20)` | Hayır | Prisma: ""; Django:  |
| `lineInt` → `line_int` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `reference` → `reference` | `varchar(100)` | Hayır | Prisma: "" |
| `notes` → `notes` | `varchar(500)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `targetDate` → `target_date` | `date` | Evet |  |
| `projectCodeId` → `project_code_id` | `integer` | Evet |  |
| `orderId` → `order_id` | `integer` | Hayır |  |
| `partId` → `part_id` | `integer` | Evet |  |
| `transferred` → `transferred` | `numeric(15,5)` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `projectCodeId` → `ProjectCode.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `orderId` → `TransferOrder.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `partId` → `Part.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `orderId`.
- INDEX: `partId`.
- INDEX: `projectCodeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"discount" >= 0`.
- SQL CHECK: `"discount" <= 100`.
- SQL CHECK: `"transferred" >= 0`.

## TransferOrderAllocation

Tablo: `transfer_order_allocation`. This model is used to 'allocate' stock items to a TransferOrder. Items that are "allocated" to a TransferOrder are not yet "attached" to the order, but they will be once the order is fulfilled.

Kaynak: `src/backend/InvenTree/order/models.py:4088`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `lineId` → `line_id` | `integer` | Hayır |  |
| `itemId` → `item_id` | `integer` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |

**İlişkiler**

- `lineId` → `TransferOrderLineItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `itemId` → `StockItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `itemId`.
- INDEX: `lineId`.
- SQL CHECK: `"quantity" >= 0`.

