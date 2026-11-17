-- Retire stock locations and recipe substitutes from active application writes.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window after a backup, with writers stopped.
--
-- Data preservation: no table is dropped or renamed and no business row is
-- deleted. The stock_location and bom_item_substitute tables keep every row,
-- foreign key, index, and historical value. Prisma excludes those models (and
-- the obsolete location/destination scalar fields on active models) with the
-- @@ignore/@ignore convention; the physical columns stay available to the
-- database and to historical reporting tools.
--
-- The sale preparation tables keep their historical location snapshots. Those
-- snapshot columns become nullable and lose their obsolete empty-string
-- defaults so a location-free sale inserts NULL instead of fabricating an
-- empty location name or path. Existing values are not rewritten.
--
-- Stored dynamic-role permission JSON loses exactly the retired
-- stock_location key. Every other scope key and every action array keeps its
-- value, including native organization, member, invitation, team, ac, and
-- ownership grants. The application rejects unknown permission keys, so this
-- cleanup must run before the new code that no longer knows the
-- stock_location scope starts.
--
-- Deployment order: stop all writers, apply this script, then start the new
-- code. This script has not been executed against any database by this change.

BEGIN;

LOCK TABLE "build", "build_consumption", "organization_role"
  IN ACCESS EXCLUSIVE MODE;

-- Archiving the sale location snapshots means new location-free writes omit
-- these columns. They must accept NULL because the active Build and
-- BuildConsumption create paths no longer send a value.
ALTER TABLE "build"
  ALTER COLUMN "requested_source_location_id" DROP NOT NULL;
ALTER TABLE "build"
  ALTER COLUMN "source_location_name" DROP NOT NULL;
ALTER TABLE "build"
  ALTER COLUMN "source_location_path" DROP NOT NULL,
  ALTER COLUMN "source_location_path" DROP DEFAULT;

ALTER TABLE "build_consumption"
  ALTER COLUMN "stock_location_name" DROP NOT NULL;
ALTER TABLE "build_consumption"
  ALTER COLUMN "stock_location_path" DROP NOT NULL,
  ALTER COLUMN "stock_location_path" DROP DEFAULT;

-- Remove only the retired scope key. jsonb subtraction leaves all other keys
-- and values untouched, including empty action arrays and unknown keys.
WITH current AS (
  SELECT id, permission::jsonb AS body
  FROM "organization_role"
  WHERE permission::jsonb ? 'stock_location'
)
UPDATE "organization_role" AS role
SET permission = (current.body - 'stock_location')::text
FROM current
WHERE role.id = current.id;

COMMIT;
