-- Purchase order reservations and their cash settlement on the finance ledger.
-- Forward migration for the state produced by 20261128000000_order_line_currency.
-- It does not record that it was applied and it has not been executed against
-- any database by this change. Prisma does not wrap a PostgreSQL migration in a
-- transaction, so this file is one explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * `money_movement` gains `status`, `purchase_order_id`,
--     `pricing_incomplete` and `pricing_issue_count`. Every existing row keeps
--     `status` 20 (posted), so the posted cash balance of recorded history is
--     exactly what it was; no amount, code or note is rewritten.
--   * Entry kind 60 (purchase) is a reservation row: `status` 10 is on hold,
--     20 posted and 30 cancelled. Only a purchase row may sit outside 20, may
--     carry a zero amount, and may be negative or zero (reserved outflow).
--     Every other kind stays posted, so a zero-income/expense/sale/reversal row
--     is still rejected.
--   * At most one purchase row exists per `(organization_id, purchase_order_id)`
--     and at most one auto-posted settlement payment exists per order, so an
--     order can never reserve or settle twice.
--   * The auto-posted settlement credit is a kind 30 (payment) entry that links
--     the purchase movement through the unchanged unique `money_movement_id`;
--     the purchase debit (kind 20) links only its order and carries no money
--     movement, so one cash movement still has at most one ledger entry and the
--     payment source check keeps requiring a money movement.
--   * Backfill only reserves the still-active orders (status 10, 20, 25) of an
--     organization whose finance currency exists AND equals the configured
--     system currency. The hold amount is the sum of the order's priced item and
--     extra lines recorded in exactly that currency; a line with no price, no
--     currency, or another currency is counted in `pricing_issue_count` and left
--     out of the sum instead of being treated as zero or added across
--     currencies. An order with no line, or with any such line, is marked
--     `pricing_incomplete`. An organization without a finance row, or with a
--     legacy row in another code, gets no invented or alternative-currency
--     reservation: its active orders receive their reservation on their next
--     priced write, after that conflict is reconciled. Completed, cancelled and
--     historical orders receive no reservation and no cash debit, and the
--     existing supplier ledger is never offset, relabelled or rewritten.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that reads the reservation lifecycle.

BEGIN;

LOCK TABLE "money_movement", "supplier_ledger_entry", "purchase_order",
  "purchase_order_line_item", "purchase_order_extra_line",
  "organization_finance", "system_preference"
  IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "money_movement"
  ADD COLUMN "status" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "purchase_order_id" INTEGER,
  ADD COLUMN "pricing_incomplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pricing_issue_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "money_movement"
  DROP CONSTRAINT "money_movement_entry_kind_check",
  DROP CONSTRAINT "money_movement_amount_check";

ALTER TABLE "money_movement"
  ADD CONSTRAINT "money_movement_entry_kind_check"
    CHECK ("entry_kind" IN (20, 30, 40, 50, 60, 90)),
  ADD CONSTRAINT "money_movement_amount_check"
    CHECK ("amount" <> 0 OR "entry_kind" = 60),
  ADD CONSTRAINT "money_movement_status_check"
    CHECK (
      ("entry_kind" = 60 AND "status" IN (10, 20, 30))
      OR ("entry_kind" <> 60 AND "status" = 20)
    ),
  ADD CONSTRAINT "money_movement_purchase_amount_check"
    CHECK ("entry_kind" <> 60 OR "amount" <= 0),
  ADD CONSTRAINT "money_movement_purchase_source_check"
    CHECK ("entry_kind" <> 60 OR "purchase_order_id" IS NOT NULL),
  ADD CONSTRAINT "money_movement_pricing_check"
    CHECK (
      "entry_kind" = 60
      OR ("pricing_incomplete" = false AND "pricing_issue_count" = 0)
    ),
  ADD CONSTRAINT "money_movement_pricing_issue_count_check"
    CHECK ("pricing_issue_count" >= 0),
  ADD CONSTRAINT "money_movement_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "money_movement_purchase_order_key"
  ON "money_movement"("organization_id", "purchase_order_id")
  WHERE "entry_kind" = 60;
CREATE INDEX "money_movement_purchase_order_id_idx"
  ON "money_movement"("purchase_order_id");
CREATE INDEX "money_movement_organization_id_status_idx"
  ON "money_movement"("organization_id", "status");

CREATE UNIQUE INDEX "supplier_ledger_entry_purchase_order_payment_key"
  ON "supplier_ledger_entry"("organization_id", "purchase_order_id")
  WHERE "entry_kind" = 30;

-- Reserve the active orders that already record the configured system currency.
-- Amounts are summed only inside that one code and rounded once, like the
-- server total. A finance row in another code reserves nothing.
WITH active_order AS (
  SELECT orders."id",
         orders."organization_id",
         orders."reference",
         orders."supplier_id",
         finance."currency_code"
    FROM "purchase_order" AS orders
    JOIN "organization_finance" AS finance
      ON finance."organization_id" = orders."organization_id"
    JOIN "system_preference" AS preference
      ON preference."default_currency_code" = finance."currency_code"
   WHERE orders."status" IN (10, 20, 25)
     AND NOT EXISTS (
       SELECT 1
         FROM "money_movement" AS movement
        WHERE movement."organization_id" = orders."organization_id"
          AND movement."purchase_order_id" = orders."id"
          AND movement."entry_kind" = 60
     )
),
line_row AS (
  SELECT line."organization_id",
         line."order_id",
         line."currency_code",
         line."quantity" * line."purchase_price" * (1 - line."discount" / 100)
           AS "amount",
         (line."purchase_price" IS NULL OR line."currency_code" IS NULL)
           AS "unpriced"
    FROM "purchase_order_line_item" AS line
  UNION ALL
  SELECT extra."organization_id",
         extra."order_id",
         extra."currency_code",
         extra."quantity" * extra."price" * (1 - extra."discount" / 100),
         (extra."price" IS NULL OR extra."currency_code" IS NULL)
    FROM "purchase_order_extra_line" AS extra
),
reservation AS (
  SELECT orders."id" AS "order_id",
         orders."organization_id",
         orders."reference",
         orders."supplier_id",
         orders."currency_code",
         COALESCE(
           round(
             SUM(
               CASE
                 WHEN row."currency_code" = orders."currency_code"
                 THEN row."amount"
               END
             ),
             6
           ),
           0
         ) AS "hold_amount",
         count(row."order_id") AS "line_count",
         COALESCE(
           SUM(
             CASE
               WHEN row."order_id" IS NULL THEN 0
               WHEN row."unpriced"
                 OR row."currency_code" IS DISTINCT FROM orders."currency_code"
               THEN 1
               ELSE 0
             END
           ),
           0
         ) AS "issue_count"
    FROM active_order AS orders
    LEFT JOIN line_row AS row
      ON row."order_id" = orders."id"
     AND row."organization_id" = orders."organization_id"
   GROUP BY orders."id",
            orders."organization_id",
            orders."reference",
            orders."supplier_id",
            orders."currency_code"
)
INSERT INTO "money_movement" (
  "organization_id",
  "entry_kind",
  "status",
  "currency_code",
  "amount",
  "occurred_at",
  "note",
  "purchase_order_id",
  "supplier_id",
  "pricing_incomplete",
  "pricing_issue_count"
)
SELECT reservation."organization_id",
       60,
       10,
       reservation."currency_code",
       -reservation."hold_amount",
       (now() AT TIME ZONE 'UTC')::date,
       'Purchase order ' || reservation."reference",
       reservation."order_id",
       reservation."supplier_id",
       (reservation."line_count" = 0 OR reservation."issue_count" > 0),
       reservation."issue_count"
  FROM reservation;

COMMIT;
