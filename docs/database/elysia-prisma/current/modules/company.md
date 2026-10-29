# Firma, üretici ve tedarikçi

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/company.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## Company

Tablo: `company_company`. A Company object represents an external company.

Kaynak: `src/backend/InvenTree/company/models.py:78`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `image` → `image` | `varchar(100)` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(500)` | Hayır |  |
| `website` → `website` | `varchar(2000)` | Hayır |  |
| `phone` → `phone` | `varchar(50)` | Hayır |  |
| `email` → `email` | `varchar(254)` | Evet |  |
| `contact` → `contact` | `varchar(100)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `is_customer` → `is_customer` | `boolean` | Hayır | Django: False |
| `is_supplier` → `is_supplier` | `boolean` | Hayır | Django: True |
| `is_manufacturer` → `is_manufacturer` | `boolean` | Hayır | Django: False |
| `currency` → `currency` | `varchar(3)` | Hayır | Django: currency_code_default |
| `tax_id` → `tax_id` | `varchar(50)` | Hayır |  |

**Kısıtlar ve indeksler**

- UNIQUE: `name, email`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## Contact

Tablo: `company_contact`. A Contact represents a person who works at a particular company. A Company may have zero or more associated Contact objects.

Kaynak: `src/backend/InvenTree/company/models.py:299`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `company_id` → `company_id` | `integer` | Hayır |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `phone` → `phone` | `varchar(100)` | Hayır |  |
| `email` → `email` | `varchar(254)` | Hayır |  |
| `role` → `role` | `varchar(100)` | Hayır |  |

**İlişkiler**

- `company_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `company_id`.

## Address

Tablo: `company_address`. An address represents a physical location where the company is located. It is possible for a company to have multiple locations.

Kaynak: `src/backend/InvenTree/company/models.py:335`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `company_id` → `company_id` | `integer` | Hayır |  |
| `title` → `title` | `varchar(100)` | Hayır |  |
| `primary` → `primary` | `boolean` | Hayır | Django: False |
| `line1` → `line1` | `varchar(50)` | Hayır |  |
| `line2` → `line2` | `varchar(50)` | Hayır |  |
| `postal_code` → `postal_code` | `varchar(10)` | Hayır |  |
| `postal_city` → `postal_city` | `varchar(50)` | Hayır |  |
| `province` → `province` | `varchar(50)` | Hayır |  |
| `country` → `country` | `varchar(50)` | Hayır |  |
| `shipping_notes` → `shipping_notes` | `varchar(100)` | Hayır |  |
| `internal_shipping_notes` → `internal_shipping_notes` | `varchar(100)` | Hayır |  |
| `link` → `link` | `varchar(2000)` | Hayır |  |

**İlişkiler**

- `company_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `company_id`.

## ManufacturerPart

Tablo: `company_manufacturerpart`. Represents a unique part as provided by a Manufacturer Each ManufacturerPart is identified by a MPN (Manufacturer Part Number) Each ManufacturerPart is also linked to a Part object. A Part may be available from multiple manufacturers.

Kaynak: `src/backend/InvenTree/company/models.py:489`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `manufacturer_id` → `manufacturer_id` | `integer` | Evet |  |
| `MPN` → `MPN` | `varchar(100)` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `description` → `description` | `varchar(250)` | Evet |  |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `manufacturer_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, manufacturer_id, MPN`.
- INDEX: `manufacturer_id`.
- INDEX: `part_id`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SupplierPart

Tablo: `part_supplierpart`. Represents a unique part as provided by a Supplier Each SupplierPart is identified by a SKU (Supplier Part Number) Each SupplierPart is also linked to a Part or ManufacturerPart object. A Part may be available from multiple suppliers.

Kaynak: `src/backend/InvenTree/company/models.py:604`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `supplier_id` → `supplier_id` | `integer` | Hayır |  |
| `SKU` → `SKU` | `varchar(100)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `primary` → `primary` | `boolean` | Hayır | Django: False |
| `manufacturer_part_id` → `manufacturer_part_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `description` → `description` | `varchar(250)` | Evet |  |
| `note` → `note` | `varchar(100)` | Evet |  |
| `base_cost` → `base_cost` | `numeric(10,3)` | Hayır | Django: 0 |
| `packaging` → `packaging` | `varchar(50)` | Evet |  |
| `pack_quantity` → `pack_quantity` | `varchar(25)` | Hayır |  |
| `pack_quantity_native` → `pack_quantity_native` | `numeric(20,10)` | Evet | Django: 1 |
| `multiple` → `multiple` | `integer` | Hayır | Django: 1 |
| `available` → `available` | `numeric(10,3)` | Hayır | Django: 0 |
| `availability_updated` → `availability_updated` | `timestamptz(6)` | Evet |  |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `supplier_id` → `Company.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `manufacturer_part_id` → `ManufacturerPart.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, supplier_id, SKU`.
- INDEX: `manufacturer_part_id`.
- INDEX: `part_id`.
- INDEX: `supplier_id`.
- SQL CHECK: `"multiple" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## SupplierPriceBreak

Tablo: `part_supplierpricebreak`. Represents a quantity price break for a SupplierPart.

Kaynak: `src/backend/InvenTree/company/models.py:1002`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `part_id` → `SupplierPart.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, quantity`.
- INDEX: `part_id`.

