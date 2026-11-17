-- Recipe sellability.
-- Forward-only, additive migration for the state produced by
-- `20261204000000_recipe_codes`; earlier migration files are not modified.
-- Prisma does not wrap a PostgreSQL migration in a transaction, so this file is
-- one explicit BEGIN/COMMIT block.
--
-- `recipe.sellable` marks a definition that may be sold directly. It is not a
-- second activation flag: `active` and the branch activation still decide
-- whether a definition exists in a branch, and sellability only decides whether
-- a direct sale is allowed. A nested ingredient recipe therefore never has to
-- be sellable or priced.
--
-- The backfill is derived from data already stored: a definition that carried
-- both a selling price and its currency snapshot becomes sellable, everything
-- else stays non-sellable. No price or currency is inferred and no other column
-- is rewritten, so a formerly priced recipe keeps selling exactly as before.
--
-- The new check only adds the sellable implication. The pre-existing
-- `recipe_selling_price_check` (nonnegative price) and
-- `recipe_price_currency_check` (price and currency both null or both set, with
-- an ISO 4217-shaped code) already cover the amount and pairing, so they are
-- neither redefined nor duplicated here.

BEGIN;

LOCK TABLE "recipe" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "recipe"
  ADD COLUMN "sellable" BOOLEAN NOT NULL DEFAULT false;

UPDATE "recipe"
SET "sellable" = true
WHERE "selling_price" IS NOT NULL
  AND "price_currency_code" IS NOT NULL;

ALTER TABLE "recipe"
  ADD CONSTRAINT "recipe_sellable_price_check"
    CHECK (
      NOT "sellable"
      OR ("selling_price" IS NOT NULL AND "price_currency_code" IS NOT NULL)
    );

COMMIT;
