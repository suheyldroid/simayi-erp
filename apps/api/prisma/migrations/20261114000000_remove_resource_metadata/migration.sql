-- Remove the generic resource metadata columns and the retired supplier
-- website and link fields from Prisma and PostgreSQL.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window with all writers stopped.
--
-- Scope: every application-owned generic metadata column: user_profile,
-- supplier, part_category, purchase_order, purchase_order_line_item,
-- purchase_order_extra_line, selection_list, note, and attachment, plus
-- supplier.website and supplier.link.
--
-- It does not touch the native Better Auth organization.metadata column or
-- business JSON on item_tracking.deltas and purchase_order_extra_line.context.
-- No table is dropped, no rows are rewritten, and no statement uses CASCADE.
--
-- This script has not been executed against any database by this change.

BEGIN;

ALTER TABLE "user_profile" DROP COLUMN "metadata";

ALTER TABLE "supplier"
  DROP COLUMN "metadata",
  DROP COLUMN "website",
  DROP COLUMN "link";

ALTER TABLE "part_category" DROP COLUMN "metadata";

ALTER TABLE "purchase_order" DROP COLUMN "metadata";

ALTER TABLE "purchase_order_line_item" DROP COLUMN "metadata";

ALTER TABLE "purchase_order_extra_line" DROP COLUMN "metadata";

ALTER TABLE "selection_list" DROP COLUMN "metadata";

ALTER TABLE "note" DROP COLUMN "metadata";

ALTER TABLE "attachment" DROP COLUMN "metadata";

COMMIT;
