-- Drops denomination labels, exchange tables, Build.external, company/contact
-- email, and unused email message tables. Numeric prices, quantities, discounts,
-- and totals are left unchanged. No conversion and no replacement currency are
-- applied. Company name uniqueness is not introduced; duplicate names stay valid.
-- Auth user email is not touched.
--
-- The file is one transaction. Prisma does not make a PostgreSQL migration
-- atomic by itself. Locks are taken before the denomination guard so a
-- concurrent price or currency write cannot land between the check and the
-- drops. Any later failure rolls the whole scope back.
--
-- Run this during a maintenance window, after a backup, with writers stopped.
-- Existing nonzero prices that already use more than one denomination cannot be
-- collapsed safely. A missing label on a nonzero amount counts as its own
-- denomination when another nonzero amount has a label. The guard then raises.
-- The transaction rolls back, no drop is kept, and the operator reconciles
-- those amounts by hand. There is no automatic conversion. A single remaining
-- denomination, or no priced rows, is discarded with the columns.

BEGIN;

-- Alphabetical ACCESS EXCLUSIVE locks. Same order on every run.
LOCK TABLE "company" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "exchange_backend" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "part_internal_price_break" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "part_sell_price_break" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "purchase_order" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "purchase_order_extra_line" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "purchase_order_line_item" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "rate" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "stock_item" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "supplier_price_break" IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  denomination_count integer;
BEGIN
  SELECT COUNT(*) INTO denomination_count
  FROM (
    SELECT DISTINCT code
    FROM (
      SELECT COALESCE(price_currency, '') AS code
      FROM supplier_price_break
      WHERE price IS NOT NULL AND price <> 0
      UNION ALL
      SELECT COALESCE(price_currency, '')
      FROM part_sell_price_break
      WHERE price IS NOT NULL AND price <> 0
      UNION ALL
      SELECT COALESCE(price_currency, '')
      FROM part_internal_price_break
      WHERE price IS NOT NULL AND price <> 0
      UNION ALL
      SELECT COALESCE(purchase_price_currency, '')
      FROM stock_item
      WHERE purchase_price IS NOT NULL AND purchase_price <> 0
      UNION ALL
      SELECT COALESCE(order_currency, '')
      FROM purchase_order
      WHERE total_price IS NOT NULL AND total_price <> 0
      UNION ALL
      SELECT COALESCE(total_price_currency, '')
      FROM purchase_order
      WHERE total_price IS NOT NULL AND total_price <> 0
      UNION ALL
      SELECT COALESCE(purchase_price_currency, '')
      FROM purchase_order_line_item
      WHERE purchase_price IS NOT NULL AND purchase_price <> 0
      UNION ALL
      SELECT COALESCE(price_currency, '')
      FROM purchase_order_extra_line
      WHERE price IS NOT NULL AND price <> 0
    ) AS priced
  ) AS denominations;

  IF denomination_count > 1 THEN
    RAISE EXCEPTION
      'Refusing to drop currency columns: nonzero priced records use % denominations. Reconcile those amounts to one denomination, then retry. No conversion was applied and no rows were changed.',
      denomination_count;
  END IF;
END $$;

DROP TABLE "rate";
DROP TABLE "exchange_backend";

DROP INDEX "company_name_email_key";
ALTER TABLE "company" DROP CONSTRAINT "company_currency_check";
ALTER TABLE "company" DROP COLUMN "email";
ALTER TABLE "company" DROP COLUMN "currency";

ALTER TABLE "contact" DROP COLUMN "email";

ALTER TABLE "supplier_price_break" DROP CONSTRAINT "supplier_price_break_currency_check";
ALTER TABLE "supplier_price_break" DROP COLUMN "price_currency";
ALTER TABLE "part_sell_price_break" DROP COLUMN "price_currency";
ALTER TABLE "part_internal_price_break" DROP COLUMN "price_currency";
ALTER TABLE "stock_item" DROP COLUMN "purchase_price_currency";
ALTER TABLE "purchase_order" DROP COLUMN "order_currency";
ALTER TABLE "purchase_order" DROP COLUMN "total_price_currency";
ALTER TABLE "purchase_order_line_item" DROP COLUMN "purchase_price_currency";
ALTER TABLE "purchase_order_extra_line" DROP COLUMN "price_currency";

ALTER TABLE "build" DROP COLUMN "external";

ALTER TABLE "email_message" DROP CONSTRAINT "email_message_thread_id_fkey";
DROP TABLE "email_message";
DROP TABLE "email_thread";

DELETE FROM "model_type"
WHERE "app_label" = 'common'
  AND "model" IN ('emailthread', 'emailmessage');

DELETE FROM "system_setting"
WHERE "key" IN (
  'INVENTREE_DEFAULT_CURRENCY',
  'CURRENCY_UPDATE_PLUGIN',
  'CURRENCY_UPDATE_INTERVAL'
);

DELETE FROM "user_setting"
WHERE "key" IN (
  'INVENTREE_DEFAULT_CURRENCY',
  'CURRENCY_UPDATE_PLUGIN',
  'CURRENCY_UPDATE_INTERVAL'
);

COMMIT;
