# Parça kataloğu, BOM ve fiyatlar

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/part.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## PartCategory

Tablo: `part_category`. PartCategory provides hierarchical organization of Part objects.

Kaynak: `src/backend/InvenTree/part/models.py:71`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `parentId` → `parent_id` | `integer` | Evet |  |
| `pathstring` → `pathstring` | `varchar(250)` | Hayır | Prisma: "" |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `defaultLocationId` → `default_location_id` | `integer` | Evet |  |
| `structural` → `structural` | `boolean` | Hayır | Prisma: false; Django: False |
| `defaultKeywords` → `default_keywords` | `varchar(250)` | Evet |  |
| `icon` → `icon` | `varchar(100)` | Evet |  |

**İlişkiler**

- `parentId` → `PartCategory.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `defaultLocationId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `defaultLocationId`.
- INDEX: `parentId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

**Sütun olmayan Django alanları**

- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## PartCategoryParameterTemplate

Tablo: `part_category_parameter_template`. A PartCategoryParameterTemplate creates a unique relationship between a PartCategory and a ParameterTemplate.

Kaynak: `src/backend/InvenTree/part/models.py:352`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `categoryId` → `category_id` | `integer` | Hayır |  |
| `templateId` → `template_id` | `integer` | Hayır |  |
| `defaultValue` → `default_value` | `varchar(500)` | Hayır | Prisma: "" |

**İlişkiler**

- `categoryId` → `PartCategory.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `templateId` → `ParameterTemplate.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `categoryId, templateId`.
- INDEX: `templateId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## Part

Tablo: `part`. The Part object represents an abstract part, the 'concept' of an actual entity.

Kaynak: `src/backend/InvenTree/part/models.py:465`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `image` → `image` | `varchar(100)` | Evet |  |
| `barcodeData` → `barcode_data` | `varchar(500)` | Hayır | Prisma: "" |
| `barcodeHash` → `barcode_hash` | `varchar(128)` | Hayır | Prisma: "" |
| `name` → `name` | `varchar(100)` | Hayır |  |
| `isTemplate` → `is_template` | `boolean` | Hayır | Django: part_settings.part_template_default |
| `variantOfId` → `variant_of_id` | `integer` | Evet |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `keywords` → `keywords` | `varchar(250)` | Evet |  |
| `categoryId` → `category_id` | `integer` | Evet |  |
| `ipn` → `ipn` | `varchar(100)` | Evet |  |
| `revision` → `revision` | `varchar(100)` | Evet |  |
| `revisionOfId` → `revision_of_id` | `integer` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `defaultLocationId` → `default_location_id` | `integer` | Evet |  |
| `defaultExpiry` → `default_expiry` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `minimumStock` → `minimum_stock` | `numeric(19,6)` | Hayır | Prisma: 0; Django: 0 |
| `maximumStock` → `maximum_stock` | `numeric(19,6)` | Hayır | Prisma: 0; Django: 0 |
| `units` → `units` | `varchar(20)` | Evet | Prisma: ""; Django:  |
| `assembly` → `assembly` | `boolean` | Hayır | Django: part_settings.part_assembly_default |
| `component` → `component` | `boolean` | Hayır | Django: part_settings.part_component_default |
| `trackable` → `trackable` | `boolean` | Hayır | Django: part_settings.part_trackable_default |
| `testable` → `testable` | `boolean` | Hayır | Prisma: false; Django: False |
| `purchaseable` → `purchaseable` | `boolean` | Hayır | Django: part_settings.part_purchaseable_default |
| `salable` → `salable` | `boolean` | Hayır | Django: part_settings.part_salable_default |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `locked` → `locked` | `boolean` | Hayır | Prisma: false; Django: False |
| `virtual` → `virtual` | `boolean` | Hayır | Django: part_settings.part_virtual_default |
| `consumable` → `consumable` | `boolean` | Hayır | Prisma: false; Django: False |
| `bomValidated` → `bom_validated` | `boolean` | Hayır | Prisma: false; Django: False |
| `bomChecksum` → `bom_checksum` | `varchar(128)` | Hayır | Prisma: "" |
| `bomCheckedById` → `bom_checked_by_id` | `uuid` | Evet |  |
| `bomCheckedDate` → `bom_checked_date` | `date` | Evet |  |
| `creationDate` → `creation_date` | `date` | Evet | Prisma: now(); Uygulama oluşturma zamanı |
| `creationUserId` → `creation_user_id` | `uuid` | Evet |  |
| `responsibleOwnerId` → `responsible_owner_id` | `integer` | Evet |  |
| `baseCost` → `base_cost` | `numeric(19,6)` | Hayır | Prisma: 0; Django: 0 |
| `multiple` → `multiple` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `version` → `version` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `variantOfId` → `Part.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `categoryId` → `PartCategory.id`; N:1; SQL onDelete `NoAction`; kaynak Django `DO_NOTHING`.
- `revisionOfId` → `Part.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `defaultLocationId` → `StockLocation.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `bomCheckedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `creationUserId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `responsibleOwnerId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `name, ipn, revision`.
- INDEX: `categoryId, active, id`.
- INDEX: `variantOfId, id`.
- INDEX: `revisionOfId, id`.
- INDEX: `bomCheckedById`.
- INDEX: `responsibleOwnerId`.
- INDEX: `defaultLocationId`.
- INDEX: `ipn`.
- INDEX: `creationUserId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"default_expiry" >= 0`.
- SQL CHECK: `"minimum_stock" >= 0`.
- SQL CHECK: `"maximum_stock" >= 0`.
- SQL CHECK: `"base_cost" >= 0`.
- SQL CHECK: `"multiple" >= 0`.
- SQL CHECK: `"multiple" >= 1`.
- SQL CHECK: `"version" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.
- `notes_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `parameters_list`: `GenericRelation`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## PartPricing

Tablo: `part_pricing`. Model for caching min/max pricing information for a particular Part.

Kaynak: `src/backend/InvenTree/part/models.py:2606`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `currency` → `currency` | `varchar(10)` | Hayır | Django: currency_code_default |
| `scheduledForUpdate` → `scheduled_for_update` | `boolean` | Hayır | Prisma: false; Django: False |
| `partId` → `part_id` | `integer` | Hayır | UNIQUE |
| `bomCostMin` → `bom_cost_min` | `numeric(19,6)` | Evet |  |
| `bomCostMax` → `bom_cost_max` | `numeric(19,6)` | Evet |  |
| `purchaseCostMin` → `purchase_cost_min` | `numeric(19,6)` | Evet |  |
| `purchaseCostMax` → `purchase_cost_max` | `numeric(19,6)` | Evet |  |
| `internalCostMin` → `internal_cost_min` | `numeric(19,6)` | Evet |  |
| `internalCostMax` → `internal_cost_max` | `numeric(19,6)` | Evet |  |
| `supplierPriceMin` → `supplier_price_min` | `numeric(19,6)` | Evet |  |
| `supplierPriceMax` → `supplier_price_max` | `numeric(19,6)` | Evet |  |
| `variantCostMin` → `variant_cost_min` | `numeric(19,6)` | Evet |  |
| `variantCostMax` → `variant_cost_max` | `numeric(19,6)` | Evet |  |
| `overrideMin` → `override_min` | `numeric(19,6)` | Evet |  |
| `overrideMax` → `override_max` | `numeric(19,6)` | Evet |  |
| `overallMin` → `overall_min` | `numeric(19,6)` | Evet |  |
| `overallMax` → `overall_max` | `numeric(19,6)` | Evet |  |
| `salePriceMin` → `sale_price_min` | `numeric(19,6)` | Evet |  |
| `salePriceMax` → `sale_price_max` | `numeric(19,6)` | Evet |  |
| `saleHistoryMin` → `sale_history_min` | `numeric(19,6)` | Evet |  |
| `saleHistoryMax` → `sale_history_max` | `numeric(19,6)` | Evet |  |
| `bomCostMinCurrency` → `bom_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `bomCostMaxCurrency` → `bom_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `purchaseCostMinCurrency` → `purchase_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `purchaseCostMaxCurrency` → `purchase_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `internalCostMinCurrency` → `internal_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `internalCostMaxCurrency` → `internal_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `supplierPriceMinCurrency` → `supplier_price_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `supplierPriceMaxCurrency` → `supplier_price_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `variantCostMinCurrency` → `variant_cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `variantCostMaxCurrency` → `variant_cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `overrideMinCurrency` → `override_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `overrideMaxCurrency` → `override_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `overallMinCurrency` → `overall_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `overallMaxCurrency` → `overall_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `salePriceMinCurrency` → `sale_price_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `salePriceMaxCurrency` → `sale_price_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `saleHistoryMinCurrency` → `sale_history_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `saleHistoryMaxCurrency` → `sale_history_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `partId` → `Part.id`; 1:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- SQL CHECK: `"bom_cost_min" >= 0`.
- SQL CHECK: `"bom_cost_max" >= 0`.
- SQL CHECK: `"purchase_cost_min" >= 0`.
- SQL CHECK: `"purchase_cost_max" >= 0`.
- SQL CHECK: `"internal_cost_min" >= 0`.
- SQL CHECK: `"internal_cost_max" >= 0`.
- SQL CHECK: `"supplier_price_min" >= 0`.
- SQL CHECK: `"supplier_price_max" >= 0`.
- SQL CHECK: `"variant_cost_min" >= 0`.
- SQL CHECK: `"variant_cost_max" >= 0`.
- SQL CHECK: `"override_min" >= 0`.
- SQL CHECK: `"override_max" >= 0`.
- SQL CHECK: `"overall_min" >= 0`.
- SQL CHECK: `"overall_max" >= 0`.
- SQL CHECK: `"sale_price_min" >= 0`.
- SQL CHECK: `"sale_price_max" >= 0`.
- SQL CHECK: `"sale_history_min" >= 0`.
- SQL CHECK: `"sale_history_max" >= 0`.

## PartStocktake

Tablo: `part_stocktake`. Model representing a 'stock history' entry for a particular Part.

Kaynak: `src/backend/InvenTree/part/models.py:3404`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `partId` → `part_id` | `integer` | Hayır |  |
| `itemCount` → `item_count` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `quantity` → `quantity` | `numeric(19,5)` | Hayır |  |
| `date` → `date` | `date` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `costMin` → `cost_min` | `numeric(19,6)` | Evet |  |
| `costMax` → `cost_max` | `numeric(19,6)` | Evet |  |
| `costMinCurrency` → `cost_min_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |
| `costMaxCurrency` → `cost_max_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `partId`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"cost_min" >= 0`.
- SQL CHECK: `"cost_max" >= 0`.

## PartSellPriceBreak

Tablo: `part_sell_price_break`. Represents a price break for selling this part.

Kaynak: `src/backend/InvenTree/part/models.py:3456`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, quantity`.
- SQL CHECK: `"quantity" >= 1`.
- SQL CHECK: `"price" >= 0`.

## PartInternalPriceBreak

Tablo: `part_internal_price_break`. Represents a price break for internally selling this part.

Kaynak: `src/backend/InvenTree/part/models.py:3479`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1; Django: 1 |
| `price` → `price` | `numeric(19,6)` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `priceCurrency` → `price_currency` | `varchar(3)` | Evet | django-money companion currency column; default resolved by application settings |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, quantity`.
- SQL CHECK: `"quantity" >= 1`.
- SQL CHECK: `"price" >= 0`.

## PartStar

Tablo: `part_star`. A PartStar object creates a subscription relationship between a User and a Part.

Kaynak: `src/backend/InvenTree/part/models.py:3501`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `partId` → `part_id` | `integer` | Hayır |  |
| `userId` → `user_id` | `uuid` | Hayır |  |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, userId`.
- INDEX: `userId`.

## PartCategoryStar

Tablo: `part_category_star`. A PartCategoryStar creates a subscription relationship between a User and a PartCategory.

Kaynak: `src/backend/InvenTree/part/models.py:3531`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `categoryId` → `category_id` | `integer` | Hayır |  |
| `userId` → `user_id` | `uuid` | Hayır |  |

**İlişkiler**

- `categoryId` → `PartCategory.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `categoryId, userId`.
- INDEX: `userId`.

## PartTestTemplate

Tablo: `part_test_template`. A PartTestTemplate defines a 'template' for a test which is required to be run against a StockItem (an instance of the Part).

Kaynak: `src/backend/InvenTree/part/models.py:3559`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `testName` → `test_name` | `varchar(100)` | Hayır |  |
| `key` → `key` | `varchar(100)` | Hayır | Prisma: "" |
| `description` → `description` | `varchar(100)` | Evet |  |
| `enabled` → `enabled` | `boolean` | Hayır | Prisma: true; Django: True |
| `required` → `required` | `boolean` | Hayır | Prisma: true; Django: True |
| `requiresValue` → `requires_value` | `boolean` | Hayır | Prisma: false; Django: False |
| `requiresAttachment` → `requires_attachment` | `boolean` | Hayır | Prisma: false; Django: False |
| `choices` → `choices` | `varchar(5000)` | Hayır | Prisma: "" |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `partId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## BomItem

Tablo: `bom_item`. A BomItem links a part to its component items.

Kaynak: `src/backend/InvenTree/part/models.py:3724`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `partId` → `part_id` | `integer` | Hayır |  |
| `subPartId` → `sub_part_id` | `integer` | Hayır |  |
| `rawAmount` → `raw_amount` | `varchar(25)` | Hayır |  |
| `quantity` → `quantity` | `numeric(15,5)` | Hayır | Prisma: 1.0; Django: 1.0 |
| `optional` → `optional` | `boolean` | Hayır | Prisma: false; Django: False |
| `consumable` → `consumable` | `boolean` | Hayır | Prisma: false; Django: False |
| `setupQuantity` → `setup_quantity` | `numeric(15,5)` | Hayır | Prisma: 0; Django: 0 |
| `attrition` → `attrition` | `numeric(6,3)` | Hayır | Prisma: 0; Django: 0 |
| `roundingMultiple` → `rounding_multiple` | `numeric(15,5)` | Evet | Django: None |
| `pieceCount` → `piece_count` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `reference` → `reference` | `varchar(5000)` | Hayır | Prisma: "" |
| `note` → `note` | `varchar(500)` | Hayır | Prisma: "" |
| `checksum` → `checksum` | `varchar(128)` | Hayır | Prisma: "" |
| `validated` → `validated` | `boolean` | Hayır | Prisma: false; Django: False |
| `inherited` → `inherited` | `boolean` | Hayır | Prisma: false; Django: False |
| `allowVariants` → `allow_variants` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `subPartId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `subPartId`.
- INDEX: `partId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"quantity" >= 0`.
- SQL CHECK: `"setup_quantity" >= 0`.
- SQL CHECK: `"attrition" >= 0`.
- SQL CHECK: `"attrition" <= 100`.
- SQL CHECK: `"rounding_multiple" >= 0`.
- SQL CHECK: `"piece_count" >= 0`.
- SQL CHECK: `"piece_count" >= 1`.

## BomItemSubstitute

Tablo: `bom_item_substitute`. A BomItemSubstitute provides a specification for alternative parts, which can be used in a bill of materials.

Kaynak: `src/backend/InvenTree/part/models.py:4408`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `bomItemId` → `bom_item_id` | `integer` | Hayır |  |
| `partId` → `part_id` | `integer` | Hayır |  |

**İlişkiler**

- `bomItemId` → `BomItem.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `partId` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `partId, bomItemId`.
- INDEX: `bomItemId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## PartRelated

Tablo: `part_related`. Store and handle related parts (eg. mating connector, crimps, etc.).

Kaynak: `src/backend/InvenTree/part/models.py:4466`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `part1Id` → `part1_id` | `integer` | Hayır |  |
| `part2Id` → `part2_id` | `integer` | Hayır |  |
| `note` → `note` | `varchar(500)` | Hayır | Prisma: "" |

**İlişkiler**

- `part1Id` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `part2Id` → `Part.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `part1Id, part2Id`.
- INDEX: `part2Id`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

