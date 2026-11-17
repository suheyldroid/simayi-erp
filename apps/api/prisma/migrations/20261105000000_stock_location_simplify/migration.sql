-- Simplify stock locations into an independent arbitrary-depth tree.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window after a backup, with writers stopped.
--
-- Data preservation: every stock_location row, id, parent_id, owner_id, name,
-- description and pathstring value is kept. Dropping the columns only removes
-- location type, barcode, icon, metadata, structural and external data because
-- those fields are intentionally obsolete. Inbound references to stock_location
-- from stock_item, part, part_category, purchase_order, purchase_order_line_item
-- and build are untouched.
--
-- pathstring becomes TEXT so the derived path has no fixed 250 character limit;
-- the hierarchy has no depth cap. Existing path values are not rewritten here.
--
-- Both location-type foreign keys must be removed before the type table is
-- dropped. Dropping location_type_id alone would drop them implicitly; this
-- script names them so the order is explicit and a missing constraint fails
-- loudly instead of half-applying.
--
-- The stocklocationtype row is removed from the model_type registry at the end
-- of this script. It is keyed by app_label and model, never by id, so the
-- stocklocation and stockitem registry rows cannot be touched.

BEGIN;

LOCK TABLE "stock_location", "stock_location_type", "model_type" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "stock_location" DROP CONSTRAINT "stock_location_location_type_id_same_org_fkey";
ALTER TABLE "stock_location" DROP CONSTRAINT "stock_location_location_type_id_fkey";
DROP INDEX "stock_location_location_type_id_idx";
ALTER TABLE "stock_location" DROP COLUMN "location_type_id";

ALTER TABLE "stock_location" DROP CONSTRAINT "stock_location_metadata_object_check";
ALTER TABLE "stock_location" DROP COLUMN "metadata";
ALTER TABLE "stock_location" DROP COLUMN "barcode_data";
ALTER TABLE "stock_location" DROP COLUMN "barcode_hash";
ALTER TABLE "stock_location" DROP COLUMN "custom_icon";
ALTER TABLE "stock_location" DROP COLUMN "structural";
ALTER TABLE "stock_location" DROP COLUMN "external";

ALTER TABLE "stock_location" ALTER COLUMN "pathstring" TYPE TEXT;

DROP TABLE "stock_location_type";

-- Remove only the stocklocationtype registry row. The predicate names
-- app_label and model, so stocklocation and stockitem stay. References are
-- handled by the declared foreign keys; this script never deletes referencing
-- rows directly:
--   parameter_template.model_type_id            ON DELETE SET NULL (template kept)
--   parameter.model_type_id                     ON DELETE CASCADE
--   tagged_item.content_type_id                 ON DELETE CASCADE
--   note.model_type_id                          ON DELETE CASCADE (images cascade)
--   notification_message.target_content_type_id ON DELETE CASCADE
--   notification_message.source_content_type_id ON DELETE SET NULL (record kept)
-- Shared parameter templates and notification source records are therefore not
-- removed by this script; only rows that PostgreSQL declares as dependent on
-- this exact registry row follow their foreign-key action.
DELETE FROM "model_type"
WHERE "app_label" = 'stock' AND "model" = 'stocklocationtype';

COMMIT;
