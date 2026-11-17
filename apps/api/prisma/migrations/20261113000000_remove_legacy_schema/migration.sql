-- Remove the retired legacy schema surface from Prisma and PostgreSQL.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window with all writers stopped.
--
-- Scope: the ignored archival models and the orphan scalars that only pointed
-- at them. It drops the organization_role, company, contact, address,
-- stock_location, manufacturer_part, supplier_part, supplier_price_break,
-- bom_item, bom_item_substitute and item_legacy_archive tables, plus the
-- retired @ignore columns on part_category, purchase_order,
-- purchase_order_line_item, build and build_component.
--
-- It does not touch native Better Auth organization/user tables, suppliers,
-- recipes, item stock/tracking, purchase orders or recorded sales beyond the
-- retired columns listed here. No table is dropped with CASCADE. The older
-- unmodeled parameter/parameter_template/part_category_parameter_template/
-- part_sell_price_break/part_internal_price_break/part_test_template/
-- stock_item_test_result tables are outside this cleanup and stay in place.
--
-- This script has not been executed against any database by this change.

BEGIN;

-- Incoming foreign keys from tables that survive the cleanup. The simple
-- constraint names come from the Prisma datamodel; the *_same_org_fkey
-- variants were added by 20261101150000_native_organization_tenancy and are
-- dropped here explicitly before their columns go away.
ALTER TABLE "part_category"
  DROP CONSTRAINT IF EXISTS "part_category_default_location_id_fkey",
  DROP CONSTRAINT IF EXISTS "part_category_default_location_id_same_org_fkey";

ALTER TABLE "purchase_order"
  DROP CONSTRAINT IF EXISTS "purchase_order_contact_id_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_contact_id_same_org_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_address_id_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_address_id_same_org_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_destination_id_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_destination_id_same_org_fkey";

ALTER TABLE "purchase_order_line_item"
  DROP CONSTRAINT IF EXISTS "purchase_order_line_item_supplier_part_id_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_line_item_supplier_part_id_same_org_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_line_item_destination_id_fkey",
  DROP CONSTRAINT IF EXISTS "purchase_order_line_item_destination_id_same_org_fkey";

ALTER TABLE "build"
  DROP CONSTRAINT IF EXISTS "build_item_id_fkey",
  DROP CONSTRAINT IF EXISTS "build_item_id_same_org_fkey",
  DROP CONSTRAINT IF EXISTS "build_source_location_id_fkey",
  DROP CONSTRAINT IF EXISTS "build_source_location_id_same_org_fkey";

ALTER TABLE "build_component"
  DROP CONSTRAINT IF EXISTS "build_component_assembly_item_id_fkey",
  DROP CONSTRAINT IF EXISTS "build_component_assembly_item_id_same_org_fkey";

-- Indexes that exist only for the retired columns.
DROP INDEX IF EXISTS "part_category_default_location_id_idx";
DROP INDEX IF EXISTS "purchase_order_address_id_idx";
DROP INDEX IF EXISTS "purchase_order_destination_id_idx";
DROP INDEX IF EXISTS "purchase_order_contact_id_idx";
DROP INDEX IF EXISTS "purchase_order_line_item_supplier_part_id_idx";
DROP INDEX IF EXISTS "purchase_order_line_item_destination_id_idx";
DROP INDEX IF EXISTS "build_item_id_idx";
DROP INDEX IF EXISTS "build_source_location_id_idx";
DROP INDEX IF EXISTS "build_component_assembly_item_id_idx";

-- Retired columns on surviving tables.
ALTER TABLE "part_category" DROP COLUMN "default_location_id";

ALTER TABLE "purchase_order"
  DROP COLUMN "address_id",
  DROP COLUMN "contact_id",
  DROP COLUMN "destination_id";

ALTER TABLE "purchase_order_line_item"
  DROP COLUMN "destination_id",
  DROP COLUMN "supplier_part_id";

ALTER TABLE "build"
  DROP COLUMN "item_id",
  DROP COLUMN "item_ipn",
  DROP COLUMN "item_name",
  DROP COLUMN "item_units",
  DROP COLUMN "item_version",
  DROP COLUMN "recipe_checked_by_id",
  DROP COLUMN "recipe_checked_date",
  DROP COLUMN "recipe_checksum",
  DROP COLUMN "requested_item_id",
  DROP COLUMN "requested_source_location_id",
  DROP COLUMN "source_location_id",
  DROP COLUMN "source_location_name",
  DROP COLUMN "source_location_path";

ALTER TABLE "build_component"
  DROP COLUMN "assembly_item_id",
  DROP COLUMN "assembly_item_name",
  DROP COLUMN "assembly_item_ref",
  DROP COLUMN "attrition",
  DROP COLUMN "included",
  DROP COLUMN "line_checksum",
  DROP COLUMN "optional",
  DROP COLUMN "piece_count",
  DROP COLUMN "raw_amount",
  DROP COLUMN "reference",
  DROP COLUMN "rounding_multiple",
  DROP COLUMN "setup_quantity";

-- Retired archival tables. Children are dropped before their parents; no
-- CASCADE is used.
DROP TABLE "bom_item_substitute";
DROP TABLE "bom_item";

DROP TABLE "supplier_price_break";
DROP TABLE "supplier_part";
DROP TABLE "manufacturer_part";

DROP TABLE "contact";
DROP TABLE "address";
DROP TABLE "company";

DROP TABLE "stock_location";

DROP TABLE "organization_role";
DROP TABLE "item_legacy_archive";

COMMIT;
