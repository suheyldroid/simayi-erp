# Firma, üretici ve tedarikçi

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/company.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## Company

Tablo: `company`. A Company object represents an external company.

Kaynak: `src/backend/InvenTree/company/models.py:78`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `image` → `image` | `varchar(100)` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(500)` | Hayır | Prisma: "" |
| `website` → `website` | `varchar(2000)` | Hayır | Prisma: "" |
| `phone` → `phone` | `varchar(50)` | Hayır | Prisma: "" |
| `email` → `email` | `varchar(254)` | Evet |  |
| `contact` → `contact` | `varchar(100)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `isCustomer` → `is_customer` | `boolean` | Hayır | Prisma: false; Django: False |
| `isSupplier` → `is_supplier` | `boolean` | Hayır | Prisma: true; Django: True |
| `isManufacturer` → `is_manufacturer` | `boolean` | Hayır | Prisma: false; Django: False |
| `currency` → `currency` | `varchar(3)` | Hayır | Django: currency_code_default |
| `taxId` → `tax_id` | `varchar(50)` | Hayır | Prisma: "" |

**Kısıtlar ve indeksler**

- UNIQUE: `name, email`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## Contact

Tablo: `contact`. A Contact represents a person who works at a particular company. A Company may have zero or more associated Contact objects.

Kaynak: `src/backend/InvenTree/company/models.py:299`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `companyId` → `company_id` | `integer` | Hayır |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `phone` → `phone` | `varchar(100)` | Hayır | Prisma: "" |
| `email` → `email` | `varchar(254)` | Hayır | Prisma: "" |
| `role` → `role` | `varchar(100)` | Hayır | Prisma: "" |

**İlişkiler**

- `companyId` → `Company.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `companyId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## Address

Tablo: `address`. An address represents a physical location where the company is located. It is possible for a company to have multiple locations.

Kaynak: `src/backend/InvenTree/company/models.py:335`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `companyId` → `company_id` | `integer` | Hayır |  |
| `title` → `title` | `varchar(100)` | Hayır |  |
| `primary` → `primary` | `boolean` | Hayır | Prisma: false; Django: False |
| `line1` → `line1` | `varchar(50)` | Hayır | Prisma: "" |
| `line2` → `line2` | `varchar(50)` | Hayır | Prisma: "" |
| `postalCode` → `postal_code` | `varchar(10)` | Hayır | Prisma: "" |
| `postalCity` → `postal_city` | `varchar(50)` | Hayır | Prisma: "" |
| `province` → `province` | `varchar(50)` | Hayır | Prisma: "" |
| `country` → `country` | `varchar(50)` | Hayır | Prisma: "" |
| `shippingNotes` → `shipping_notes` | `varchar(100)` | Hayır | Prisma: "" |
| `internalShippingNotes` → `internal_shipping_notes` | `varchar(100)` | Hayır | Prisma: "" |
| `link` → `link` | `varchar(2000)` | Hayır | Prisma: "" |

**İlişkiler**

- `companyId` → `Company.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `companyId`.

## ManufacturerPart

Tablo: `manufacturer_part`. Represents a unique part as provided by a Manufacturer Each ManufacturerPart is identified by a MPN (Manufacturer Part Number) Each ManufacturerPart is also linked to a Part object. A Part may be available from multiple manufacturers.

Kaynak: `src/backend/InvenTree/company/models.py:489`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `partId` → `part_id` | `integer` | Hayır |  |
| `manufacturerId` → `manufacturer_id` | `integer` | Evet |  |
| `mpn` → `mpn` | `varchar(100)` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `description` → `description` | `varchar(250)` | Evet |  |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `manufacturerId` → `Company.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, manufacturerId, mpn`.
- INDEX: `manufacturerId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SupplierPart

Tablo: `supplier_part`. Represents a unique part as provided by a Supplier Each SupplierPart is identified by a SKU (Supplier Part Number) Each SupplierPart is also linked to a Part or ManufacturerPart object. A Part may be available from multiple suppliers.

Kaynak: `src/backend/InvenTree/company/models.py:604`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `supplierId` → `supplier_id` | `integer` | Hayır |  |
| `sku` → `sku` | `varchar(100)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `primary` → `primary` | `boolean` | Hayır | Prisma: false; Django: False |
| `manufacturerPartId` → `manufacturer_part_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `description` → `description` | `varchar(250)` | Evet |  |
| `note` → `note` | `varchar(100)` | Evet |  |
| `baseCost` → `base_cost` | `numeric(10,3)` | Hayır | Prisma: 0; Django: 0 |
| `packaging` → `packaging` | `varchar(50)` | Evet |  |
| `packQuantity` → `pack_quantity` | `varchar(25)` | Hayır | Prisma: "" |
| `packQuantityNative` → `pack_quantity_native` | `numeric(20,10)` | Evet | Prisma: 1; Django: 1 |
| `multiple` → `multiple` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `available` → `available` | `numeric(10,3)` | Hayır | Prisma: 0; Django: 0 |
| `availabilityUpdated` → `availability_updated` | `timestamptz(6)` | Evet |  |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `supplierId` → `Company.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `manufacturerPartId` → `ManufacturerPart.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, supplierId, sku`.
- INDEX: `manufacturerPartId`.
- INDEX: `supplierId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"base_cost" >= 0`.
- SQL CHECK: `"multiple" >= 0`.
- SQL CHECK: `"multiple" >= 1`.
- SQL CHECK: `"available" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SupplierPriceBreak

Tablo: `supplier_price_break`. Represents a quantity price break for a SupplierPart.

Kaynak: `src/backend/InvenTree/company/models.py:1002`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `partId` → `SupplierPart.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, quantity`.
- SQL CHECK: `"quantity" >= 1`.
- SQL CHECK: `"price" >= 0`.

