-- Remove the retired opening-balance concept from the finance ledger.
--
-- Forward migration applied after 20261123000000_finance_ledger. Opening
-- balances no longer exist in the application: a cash balance and a supplier
-- outstanding balance start at exactly 0 and only posted income, expenses,
-- supplier payments, sale receipts and purchase payables change them.
--
-- Data handling:
--   * Only legacy opening rows (`entry_kind = 10`) and their own linked
--     reversals (`entry_kind = 90` with `reversal_of_id` pointing at such an
--     opening row) are deleted, child rows first so the RESTRICT reversal
--     foreign keys stay satisfied.
--   * Every real financial movement stays untouched: income, expense, supplier
--     payment, sale receipt, purchase payable and the reversals of those rows.
--     `organization_finance` currency rows and `request_key` replay history of
--     real entries are unchanged.
--   * The opening-only unique indexes are dropped and the entry-kind CHECK
--     constraints are recreated without kind 10.
--
-- Serialization: the whole migration is one transaction that takes the finance
-- advisory lock used by every API finance writer (814207) before locking both
-- ledger tables exclusively, so no writer can insert an opening row while the
-- cleanup and constraint swap run.
--
-- No row is written or rewritten beyond this scoped deletion. Prisma does not
-- wrap a PostgreSQL migration in a transaction, so this file is one explicit
-- BEGIN/COMMIT block.

BEGIN;

SELECT pg_advisory_xact_lock(814207::bigint);

LOCK TABLE "money_movement", "supplier_ledger_entry"
  IN ACCESS EXCLUSIVE MODE;

-- Supplier ledger: the opening-only reversal rows, then the opening rows.
DELETE FROM "supplier_ledger_entry"
WHERE "entry_kind" = 90
  AND "reversal_of_id" IN (
    SELECT "id" FROM "supplier_ledger_entry" WHERE "entry_kind" = 10
  );

DELETE FROM "supplier_ledger_entry" WHERE "entry_kind" = 10;

-- Cash movements: the opening-only reversal rows, then the opening rows.
DELETE FROM "money_movement"
WHERE "entry_kind" = 90
  AND "reversal_of_id" IN (
    SELECT "id" FROM "money_movement" WHERE "entry_kind" = 10
  );

DELETE FROM "money_movement" WHERE "entry_kind" = 10;

DROP INDEX "money_movement_opening_key";
DROP INDEX "supplier_ledger_entry_opening_key";

ALTER TABLE "money_movement"
  DROP CONSTRAINT "money_movement_entry_kind_check",
  ADD CONSTRAINT "money_movement_entry_kind_check"
    CHECK ("entry_kind" IN (20, 30, 40, 50, 90));

ALTER TABLE "supplier_ledger_entry"
  DROP CONSTRAINT "supplier_ledger_entry_entry_kind_check",
  ADD CONSTRAINT "supplier_ledger_entry_entry_kind_check"
    CHECK ("entry_kind" IN (20, 30, 90));

COMMIT;
