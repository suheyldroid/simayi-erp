-- Retire custom record access from active application writes.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window after a backup, with writers stopped.
--
-- Data preservation: no table is dropped or renamed and no business row is
-- deleted. The stock_item, stock_item_tracking and build_consumption tables
-- keep every retained access_open / access_user_id / access_team_id column and
-- every historical value. Prisma excludes those columns with the @ignore
-- convention and no longer reads or writes them.
--
-- Only access-only database objects are removed: the triggers and functions
-- that copied owner identity into those columns, the ON DELETE RESTRICT
-- foreign keys that blocked deleting a native user or team because of dead
-- access copies, and the indexes that served access filtering. The access
-- identity check constraints stay, so retained rows keep their constraint
-- history.
--
-- Deployment order: stop all writers, apply this script, then start the new
-- code that no longer knows about record access. This script has not been
-- executed against any database by this change.

BEGIN;

LOCK TABLE "stock_item", "stock_item_tracking", "build_consumption", "owner"
  IN ACCESS EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS "stock_item_access_before_write" ON "stock_item";
DROP TRIGGER IF EXISTS "stock_item_retain_history" ON "stock_item";
DROP TRIGGER IF EXISTS "owner_refresh_stock_access" ON "owner";

DROP FUNCTION IF EXISTS "stock_item_access_before_write"();
DROP FUNCTION IF EXISTS "stock_item_retain_history"();
DROP FUNCTION IF EXISTS "owner_refresh_stock_access"();

ALTER TABLE "stock_item" DROP CONSTRAINT IF EXISTS "stock_item_access_user_id_fkey";
ALTER TABLE "stock_item" DROP CONSTRAINT IF EXISTS "stock_item_organization_id_access_team_id_fkey";
ALTER TABLE "stock_item_tracking" DROP CONSTRAINT IF EXISTS "stock_item_tracking_access_user_id_fkey";
ALTER TABLE "stock_item_tracking" DROP CONSTRAINT IF EXISTS "stock_item_tracking_organization_id_access_team_id_fkey";
ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_access_user_id_fkey";
ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_organization_id_access_team_id_fkey";

DROP INDEX IF EXISTS "stock_item_access_open_idx";
DROP INDEX IF EXISTS "stock_item_access_user_id_idx";
DROP INDEX IF EXISTS "stock_item_access_team_id_idx";
DROP INDEX IF EXISTS "stock_item_tracking_access_open_idx";
DROP INDEX IF EXISTS "stock_item_tracking_access_user_id_idx";
DROP INDEX IF EXISTS "stock_item_tracking_access_team_id_idx";
DROP INDEX IF EXISTS "build_consumption_access_open_idx";
DROP INDEX IF EXISTS "build_consumption_access_user_id_idx";
DROP INDEX IF EXISTS "build_consumption_access_team_id_idx";

COMMIT;
