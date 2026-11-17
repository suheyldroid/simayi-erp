-- Recipe product code.
-- Forward-only, additive migration for the state produced by
-- `20261203000000_unit_divisibility`; earlier migration files are not modified.
-- Prisma does not wrap a PostgreSQL migration in a transaction, so this file is
-- one explicit BEGIN/COMMIT block.
--
-- `recipe.code` is the exact external product code a sales spreadsheet prints.
-- It is nullable and every existing row stays NULL: no code is inferred from a
-- name, an item IPN, a saved product mapping or any other column, so nothing is
-- rewritten and no recipe suddenly becomes matchable.
-- The column is `VARCHAR(100)` text, never numeric: leading zeros stay
-- significant and comparison is exact and case-sensitive.
-- No uniqueness constraint is added. Duplicate codes are allowed as metadata;
-- a batch import refuses an ambiguous active match in the target branch instead
-- of choosing one arbitrarily.
-- The index serves the exact-code lookup of one organization's candidates; the
-- branch and activation gate is applied on the resolved effective definition.

BEGIN;

ALTER TABLE "recipe" ADD COLUMN "code" VARCHAR(100);

CREATE INDEX "recipe_organization_id_code_idx"
  ON "recipe"("organization_id", "code");

COMMIT;
