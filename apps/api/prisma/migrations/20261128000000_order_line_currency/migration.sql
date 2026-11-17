-- Per-line purchase currency and removal of the purchase-order header currency.
-- Forward migration for the state produced by 20261127000000_user_avatar_media.
-- It does not record that it was applied and it has not been executed against
-- any database by this change. Prisma does not wrap a PostgreSQL migration in a
-- transaction, so this file is one explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * `purchase_order_line_item` and `purchase_order_extra_line` gain a
--     nullable `currency_code` snapshot. Every existing line first receives the
--     currency already stored on its own order, so a historical amount keeps
--     exactly the code it was recorded with.
--   * A line whose order has no stored currency stays NULL (unknown). No code
--     is guessed, defaulted or taken from the current system preference, and no
--     amount, quantity, discount or total is converted or relabelled.
--   * `purchase_order.currency_code` and its shape check are dropped only after
--     the copy. The new line columns keep the same canonical uppercase shape
--     check and allow NULL for unknown history.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that reads per-line currency and no longer reads a header currency.

BEGIN;

LOCK TABLE "purchase_order", "purchase_order_line_item",
  "purchase_order_extra_line"
  IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "purchase_order_line_item"
  ADD COLUMN "currency_code" VARCHAR(3);
ALTER TABLE "purchase_order_extra_line"
  ADD COLUMN "currency_code" VARCHAR(3);

-- 1. Move each order's stored code onto its own item and extra lines. A NULL
--    header leaves the line unknown; nothing is inferred from the catalog or
--    from the current system preference.
UPDATE "purchase_order_line_item" AS line
   SET "currency_code" = orders."currency_code"
  FROM "purchase_order" AS orders
 WHERE orders."organization_id" = line."organization_id"
   AND orders."id" = line."order_id"
   AND orders."currency_code" IS NOT NULL;

UPDATE "purchase_order_extra_line" AS extra
   SET "currency_code" = orders."currency_code"
  FROM "purchase_order" AS orders
 WHERE orders."organization_id" = extra."organization_id"
   AND orders."id" = extra."order_id"
   AND orders."currency_code" IS NOT NULL;

-- 2. Canonical shape only. Whether a code is still an active ISO 4217 code is a
--    server catalog concern for new writes; stored history is never revalidated.
ALTER TABLE "purchase_order_line_item"
  ADD CONSTRAINT "purchase_order_line_item_currency_code_check"
  CHECK ("currency_code" IS NULL OR "currency_code" ~ '^[A-Z]{3}$');
ALTER TABLE "purchase_order_extra_line"
  ADD CONSTRAINT "purchase_order_extra_line_currency_code_check"
  CHECK ("currency_code" IS NULL OR "currency_code" ~ '^[A-Z]{3}$');

-- 3. The header currency has been copied; remove it and its obsolete check.
ALTER TABLE "purchase_order"
  DROP CONSTRAINT "purchase_order_currency_code_check";
ALTER TABLE "purchase_order"
  DROP COLUMN "currency_code";

COMMIT;
