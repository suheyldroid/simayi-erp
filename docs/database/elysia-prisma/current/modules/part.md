# Parça kataloğu, BOM ve fiyatlar

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/part.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## PartCategory

Tablo: `part_partcategory`. PartCategory provides hierarchical organization of Part objects.

Kaynak: `src/backend/InvenTree/part/models.py:71`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `parent_id` → `parent_id` | `integer` | Evet |  |
| `pathstring` → `pathstring` | `varchar(250)` | Hayır |  |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `default_location_id` → `default_location_id` | `integer` | Evet |  |
| `structural` → `structural` | `boolean` | Hayır | Django: False |
| `default_keywords` → `default_keywords` | `varchar(250)` | Evet |  |
| `icon` → `icon` | `varchar(100)` | Evet |  |
| `lft` → `lft` | `integer` | Hayır | django-mptt generated nested-set column |
| `rght` → `rght` | `integer` | Hayır | django-mptt generated nested-set column |
| `tree_id` → `tree_id` | `integer` | Hayır | django-mptt generated nested-set column |
| `level` → `level` | `integer` | Hayır | django-mptt generated nested-set column |

**İlişkiler**

- `parent_id` → `PartCategory.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `default_location_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `default_location_id`.
- INDEX: `parent_id`.
- INDEX: `tree_id`.
- INDEX: `tree_id, lft`.
- SQL CHECK: `"lft" >= 0`.
- SQL CHECK: `"rght" >= 0`.
- SQL CHECK: `"tree_id" >= 0`.
- SQL CHECK: `"level" >= 0`.

**Sütun olmayan Django alanları**

- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## PartCategoryParameterTemplate

Tablo: `part_partcategoryparametertemplate`. A PartCategoryParameterTemplate creates a unique relationship between a PartCategory and a ParameterTemplate.

Kaynak: `src/backend/InvenTree/part/models.py:352`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `category_id` → `category_id` | `integer` | Hayır |  |
| `template_id` → `template_id` | `integer` | Hayır |  |
| `default_value` → `default_value` | `varchar(500)` | Hayır |  |

**İlişkiler**

- `category_id` → `PartCategory.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `template_id` → `ParameterTemplate.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `category_id, template_id`.
- INDEX: `category_id`.
- INDEX: `template_id`.

## Part

Tablo: `part_part`. The Part object represents an abstract part, the 'concept' of an actual entity.

Kaynak: `src/backend/InvenTree/part/models.py:465`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `image` → `image` | `varchar(100)` | Evet |  |
| `barcode_data` → `barcode_data` | `varchar(500)` | Hayır |  |
| `barcode_hash` → `barcode_hash` | `varchar(128)` | Hayır |  |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `is_template` → `is_template` | `boolean` | Hayır | Django: part_settings.part_template_default |
| `variant_of_id` → `variant_of_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `keywords` → `keywords` | `varchar(250)` | Evet |  |
| `category_id` → `category_id` | `integer` | Evet |  |
| `IPN` → `IPN` | `varchar(100)` | Evet |  |
| `revision` → `revision` | `varchar(100)` | Evet |  |
| `revision_of_id` → `revision_of_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `default_location_id` → `default_location_id` | `integer` | Evet |  |
| `default_expiry` → `default_expiry` | `integer` | Hayır | Django: 0 |
| `minimum_stock` → `minimum_stock` | `numeric(19,6)` | Hayır | Django: 0 |
| `maximum_stock` → `maximum_stock` | `numeric(19,6)` | Hayır | Django: 0 |
| `units` → `units` | `varchar(20)` | Evet | Django:  |
| `assembly` → `assembly` | `boolean` | Hayır | Django: part_settings.part_assembly_default |
| `component` → `component` | `boolean` | Hayır | Django: part_settings.part_component_default |
| `trackable` → `trackable` | `boolean` | Hayır | Django: part_settings.part_trackable_default |
| `testable` → `testable` | `boolean` | Hayır | Django: False |
| `purchaseable` → `purchaseable` | `boolean` | Hayır | Django: part_settings.part_purchaseable_default |
| `salable` → `salable` | `boolean` | Hayır | Django: part_settings.part_salable_default |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `locked` → `locked` | `boolean` | Hayır | Django: False |
| `virtual` → `virtual` | `boolean` | Hayır | Django: part_settings.part_virtual_default |
| `consumable` → `consumable` | `boolean` | Hayır | Django: False |
| `bom_validated` → `bom_validated` | `boolean` | Hayır | Django: False |
| `bom_checksum` → `bom_checksum` | `varchar(128)` | Hayır |  |
| `bom_checked_by_id` → `bom_checked_by_id` | `integer` | Evet |  |
| `bom_checked_date` → `bom_checked_date` | `date` | Evet |  |
| `creation_date` → `creation_date` | `date` | Evet | Uygulama oluşturma zamanı |
| `creation_user_id` → `creation_user_id` | `integer` | Evet |  |
| `responsible_owner_id` → `responsible_owner_id` | `integer` | Evet |  |
| `base_cost` → `base_cost` | `numeric(19,6)` | Hayır | Django: 0 |
| `multiple` → `multiple` | `integer` | Hayır | Django: 1 |
| `lft` → `lft` | `integer` | Hayır | django-mptt generated nested-set column |
| `rght` → `rght` | `integer` | Hayır | django-mptt generated nested-set column |
| `tree_id` → `tree_id` | `integer` | Hayır | django-mptt generated nested-set column |
| `level` → `level` | `integer` | Hayır | django-mptt generated nested-set column |

**İlişkiler**

- `variant_of_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `category_id` → `PartCategory.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `revision_of_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `default_location_id` → `StockLocation.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `bom_checked_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `creation_user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `responsible_owner_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, IPN, revision`.
- INDEX: `bom_checked_by_id`.
- INDEX: `category_id`.
- INDEX: `creation_user_id`.
- INDEX: `default_location_id`.
- INDEX: `responsible_owner_id`.
- INDEX: `revision_of_id`.
- INDEX: `tree_id`.
- INDEX: `tree_id, lft`.
- INDEX: `variant_of_id`.
- SQL CHECK: `"default_expiry" >= 0`.
- SQL CHECK: `"multiple" >= 0`.
- SQL CHECK: `"lft" >= 0`.
- SQL CHECK: `"rght" >= 0`.
- SQL CHECK: `"tree_id" >= 0`.
- SQL CHECK: `"level" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## PartPricing

Tablo: `part_partpricing`. Model for caching min/max pricing information for a particular Part.

Kaynak: `src/backend/InvenTree/part/models.py:2606`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `currency` → `currency` | `varchar(10)` | Hayır | Django: currency_code_default |
| `scheduled_for_update` → `scheduled_for_update` | `boolean` | Hayır | Django: False |
| `part_id` → `part_id` | `integer` | Hayır | UNIQUE |
| `bom_cost_min` → `bom_cost_min` | `numeric(19,6)` | Evet |  |
| `bom_cost_max` → `bom_cost_max` | `numeric(19,6)` | Evet |  |
| `purchase_cost_min` → `purchase_cost_min` | `numeric(19,6)` | Evet |  |
| `purchase_cost_max` → `purchase_cost_max` | `numeric(19,6)` | Evet |  |
| `internal_cost_min` → `internal_cost_min` | `numeric(19,6)` | Evet |  |
| `internal_cost_max` → `internal_cost_max` | `numeric(19,6)` | Evet |  |
| `supplier_price_min` → `supplier_price_min` | `numeric(19,6)` | Evet |  |
| `supplier_price_max` → `supplier_price_max` | `numeric(19,6)` | Evet |  |
| `variant_cost_min` → `variant_cost_min` | `numeric(19,6)` | Evet |  |
| `variant_cost_max` → `variant_cost_max` | `numeric(19,6)` | Evet |  |
| `override_min` → `override_min` | `numeric(19,6)` | Evet |  |
| `override_max` → `override_max` | `numeric(19,6)` | Evet |  |
| `overall_min` → `overall_min` | `numeric(19,6)` | Evet |  |
| `overall_max` → `overall_max` | `numeric(19,6)` | Evet |  |
| `sale_price_min` → `sale_price_min` | `numeric(19,6)` | Evet |  |
| `sale_price_max` → `sale_price_max` | `numeric(19,6)` | Evet |  |
| `sale_history_min` → `sale_history_min` | `numeric(19,6)` | Evet |  |
| `sale_history_max` → `sale_history_max` | `numeric(19,6)` | Evet |  |
| `bom_cost_min_currency` → `bom_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `bom_cost_max_currency` → `bom_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `purchase_cost_min_currency` → `purchase_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `purchase_cost_max_currency` → `purchase_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `internal_cost_min_currency` → `internal_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `internal_cost_max_currency` → `internal_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `supplier_price_min_currency` → `supplier_price_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `supplier_price_max_currency` → `supplier_price_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `variant_cost_min_currency` → `variant_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `variant_cost_max_currency` → `variant_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `override_min_currency` → `override_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `override_max_currency` → `override_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `overall_min_currency` → `overall_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `overall_max_currency` → `overall_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `sale_price_min_currency` → `sale_price_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `sale_price_max_currency` → `sale_price_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `sale_history_min_currency` → `sale_history_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `sale_history_max_currency` → `sale_history_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `part_id` → `Part.id`; 1:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## PartStocktake

Tablo: `part_partstocktake`. Model representing a 'stock history' entry for a particular Part.

Kaynak: `src/backend/InvenTree/part/models.py:3404`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `item_count` → `item_count` | `integer` | Hayır | Django: 1 |
| `quantity` → `quantity` | `numeric(19,5)` | Hayır |  |
| `date` → `date` | `date` | Hayır | Uygulama oluşturma zamanı |
| `cost_min` → `cost_min` | `numeric(19,6)` | Evet |  |
| `cost_max` → `cost_max` | `numeric(19,6)` | Evet |  |
| `cost_min_currency` → `cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `cost_max_currency` → `cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `part_id`.

## PartSellPriceBreak

Tablo: `part_partsellpricebreak`. Represents a price break for selling this part.

Kaynak: `src/backend/InvenTree/part/models.py:3456`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, quantity`.
- INDEX: `part_id`.

## PartInternalPriceBreak

Tablo: `part_partinternalpricebreak`. Represents a price break for internally selling this part.

Kaynak: `src/backend/InvenTree/part/models.py:3479`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1 |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `price_currency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, quantity`.
- INDEX: `part_id`.

## PartStar

Tablo: `part_partstar`. A PartStar object creates a subscription relationship between a User and a Part.

Kaynak: `src/backend/InvenTree/part/models.py:3501`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `user_id` → `user_id` | `integer` | Hayır |  |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, user_id`.
- INDEX: `part_id`.
- INDEX: `user_id`.

## PartCategoryStar

Tablo: `part_partcategorystar`. A PartCategoryStar creates a subscription relationship between a User and a PartCategory.

Kaynak: `src/backend/InvenTree/part/models.py:3531`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `category_id` → `category_id` | `integer` | Hayır |  |
| `user_id` → `user_id` | `integer` | Hayır |  |

**İlişkiler**

- `category_id` → `PartCategory.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `category_id, user_id`.
- INDEX: `category_id`.
- INDEX: `user_id`.

## PartTestTemplate

Tablo: `part_parttesttemplate`. A PartTestTemplate defines a 'template' for a test which is required to be run against a StockItem (an instance of the Part).

Kaynak: `src/backend/InvenTree/part/models.py:3559`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `test_name` → `test_name` | `varchar(100)` | Hayır |  |
| `key` → `key` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(100)` | Evet |  |
| `enabled` → `enabled` | `boolean` | Hayır | Django: True |
| `required` → `required` | `boolean` | Hayır | Django: True |
| `requires_value` → `requires_value` | `boolean` | Hayır | Django: False |
| `requires_attachment` → `requires_attachment` | `boolean` | Hayır | Django: False |
| `choices` → `choices` | `varchar(5000)` | Hayır |  |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `part_id`.

## BomItem

Tablo: `part_bomitem`. A BomItem links a part to its component items.

Kaynak: `src/backend/InvenTree/part/models.py:3724`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `part_id` → `part_id` | `integer` | Hayır |  |
| `sub_part_id` → `sub_part_id` | `integer` | Hayır |  |
| `raw_amount` → `raw_amount` | `varchar(25)` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Django: 1.0 |
| `optional` → `optional` | `boolean` | Hayır | Django: False |
| `consumable` → `consumable` | `boolean` | Hayır | Django: False |
| `setup_quantity` → `setup_quantity` | `numeric(15,5)` | Hayır | Django: 0 |
| `attrition` → `attrition` | `numeric(6,3)` | Hayır | Django: 0 |
| `rounding_multiple` → `rounding_multiple` | `numeric(15,5)` | Evet | Django: None |
| `piece_count` → `piece_count` | `integer` | Hayır | Django: 1 |
| `reference` → `reference` | `varchar(5000)` | Hayır |  |
| `note` → `note` | `varchar(500)` | Hayır |  |
| `checksum` → `checksum` | `varchar(128)` | Hayır |  |
| `validated` → `validated` | `boolean` | Hayır | Django: False |
| `inherited` → `inherited` | `boolean` | Hayır | Django: False |
| `allow_variants` → `allow_variants` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `sub_part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `part_id`.
- INDEX: `sub_part_id`.
- SQL CHECK: `"piece_count" >= 0`.

## BomItemSubstitute

Tablo: `part_bomitemsubstitute`. A BomItemSubstitute provides a specification for alternative parts, which can be used in a bill of materials.

Kaynak: `src/backend/InvenTree/part/models.py:4408`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `bom_item_id` → `bom_item_id` | `integer` | Hayır |  |
| `part_id` → `part_id` | `integer` | Hayır |  |

**İlişkiler**

- `bom_item_id` → `BomItem.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `part_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_id, bom_item_id`.
- INDEX: `bom_item_id`.
- INDEX: `part_id`.

## PartRelated

Tablo: `part_partrelated`. Store and handle related parts (eg. mating connector, crimps, etc.).

Kaynak: `src/backend/InvenTree/part/models.py:4466`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `part_1_id` → `part_1_id` | `integer` | Hayır |  |
| `part_2_id` → `part_2_id` | `integer` | Hayır |  |
| `note` → `note` | `varchar(500)` | Hayır |  |

**İlişkiler**

- `part_1_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `part_2_id` → `Part.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part_1_id, part_2_id`.
- INDEX: `part_1_id`.
- INDEX: `part_2_id`.

