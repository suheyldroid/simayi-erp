-- Unit divisibility flag (metadata only).
--
-- Forward-only migration for the state produced by
-- `20261202000000_company_branches`; earlier migration files are not modified.
--
-- The flag records whether a measurement splits into fractions (for example kg)
-- or only whole pieces (for example adet). It is descriptive: no quantity,
-- stock, recipe, order, sale, rounding or conversion rule reads it.
--
-- Every existing unit receives `true`, which preserves the current
-- decimal-capable behavior; nothing is inferred from a unit's name or code and
-- no row is rewritten. New rows default to `true` when the caller omits the
-- flag, and an explicit `false` is stored as given.

BEGIN;

ALTER TABLE "unit" ADD COLUMN "divisible" BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
