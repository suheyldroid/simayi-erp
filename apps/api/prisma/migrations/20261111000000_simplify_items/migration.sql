-- Simplify items to their active material fields.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window after a backup, with all writers stopped.
--
-- Data preservation: before dropping any column, this script copies each
-- current part row, including every retired scalar flag and relation id, into
-- item_legacy_archive as a JSONB snapshot. The archive has no foreign key to
-- part, so the snapshot survives later item deletion, and Prisma declares it
-- with @@ignore so later migrations never drop it accidentally.
--
-- No part row is deleted, merged, or relabeled. Item ids, organization
-- ownership, category links, stock lots, recipe lines, purchase lines, build
-- rows, and immutable sales snapshots keep their current references. Retired
-- template/variant/revision/lock/barcode/BOM/owner/base-cost/limit values stay
-- readable only through the archive; live rows just become ordinary materials.
--
-- Retired objects are removed explicitly: the old composite name/ipn/revision
-- unique is dropped and is not replaced by a stricter name or IPN unique, so
-- duplicate names and IPNs are allowed. Each retired foreign key, check
-- constraint, and index is dropped by name; no CASCADE is used.
--
-- This script has not been executed against any database by this change.

BEGIN;

LOCK TABLE "part" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "item_legacy_archive" (
  "part_id" INTEGER PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

INSERT INTO "item_legacy_archive" ("part_id", "organization_id", "snapshot")
SELECT p."id", p."organization_id", to_jsonb(p)
FROM "part" p;

-- Retired uniqueness: there is no composite name/IPN/revision uniqueness any
-- more. IPN stays optional and name stays required and nonblank.
DROP INDEX IF EXISTS "part_organization_id_name_ipn_revision_key";

-- Retired self-relations (variants, revisions) and location/BOM/owner links.
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_variant_of_id_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_variant_of_id_same_org_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_revision_of_id_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_revision_of_id_same_org_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_default_location_id_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_default_location_id_same_org_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_bom_checked_by_id_fkey";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_organization_id_responsible_owner_id_fkey";

DROP INDEX IF EXISTS "part_variant_of_id_id_idx";
DROP INDEX IF EXISTS "part_revision_of_id_id_idx";
DROP INDEX IF EXISTS "part_default_location_id_idx";
DROP INDEX IF EXISTS "part_bom_checked_by_id_idx";
DROP INDEX IF EXISTS "part_responsible_owner_id_idx";

ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_metadata_object_check";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_maximum_stock_check";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_base_cost_check";
ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_multiple_check";

ALTER TABLE "part"
  DROP COLUMN "metadata",
  DROP COLUMN "barcode_data",
  DROP COLUMN "barcode_hash",
  DROP COLUMN "is_template",
  DROP COLUMN "variant_of_id",
  DROP COLUMN "keywords",
  DROP COLUMN "revision",
  DROP COLUMN "revision_of_id",
  DROP COLUMN "link",
  DROP COLUMN "default_location_id",
  DROP COLUMN "maximum_stock",
  DROP COLUMN "assembly",
  DROP COLUMN "component",
  DROP COLUMN "trackable",
  DROP COLUMN "testable",
  DROP COLUMN "purchaseable",
  DROP COLUMN "salable",
  DROP COLUMN "locked",
  DROP COLUMN "virtual",
  DROP COLUMN "consumable",
  DROP COLUMN "bom_validated",
  DROP COLUMN "bom_checksum",
  DROP COLUMN "bom_checked_by_id",
  DROP COLUMN "bom_checked_date",
  DROP COLUMN "responsible_owner_id",
  DROP COLUMN "base_cost",
  DROP COLUMN "multiple";

COMMIT;
