-- Move stock ownership from stock_item lots to the item row and its tracking.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window with all writers stopped.
--
-- Data handling:
--   * part.stock receives the exact sum of every stock_item.quantity for the
--     same organization and item. The script fails instead of clipping when a
--     row crosses organizations, a balance is negative, or a sum does not fit
--     DECIMAL(20,5) (15 integer digits).
--   * Every stock_item_tracking row is copied into item_tracking with its id,
--     date, type, notes, user, and deltas unchanged. Historic lot events keep
--     quantity_before/quantity_after NULL because per-lot values never were the
--     aggregate item balance.
--   * One tracking_type 90 baseline row per migrated item records the seeded
--     aggregate balance (quantity_after = part.stock, quantity_before NULL).
--   * Every build_consumption row keeps its id, quantity, quantity_before,
--     quantity_after, and created metadata exactly. item_ref is derived from
--     the same-organization BuildComponent.component_ref; item_id links to the
--     live item only when the component still resolves in the same
--     organization, otherwise NULL. Lot-only columns are then removed.
--
-- Deployment order: stop all writers, apply this script, then start the new
-- code that only knows Item.stock and item_tracking. This script has not been
-- executed against any database by this change.

BEGIN;

LOCK TABLE "part", "stock_item", "stock_item_tracking", "stock_item_test_result",
           "build_consumption", "build_component"
  IN ACCESS EXCLUSIVE MODE;

-- Exact, guarded aggregate balance per item.
DO $$
DECLARE
  offenders BIGINT;
BEGIN
  SELECT count(*) INTO offenders
  FROM "stock_item" si
  JOIN "part" p ON p."id" = si."part_id"
  WHERE p."organization_id" <> si."organization_id";
  IF offenders > 0 THEN
    RAISE EXCEPTION 'stock_item rows reference an item owned by another organization (% rows)', offenders;
  END IF;

  SELECT count(*) INTO offenders FROM "stock_item" WHERE "quantity" < 0;
  IF offenders > 0 THEN
    RAISE EXCEPTION 'stock_item rows contain a negative quantity (% rows)', offenders;
  END IF;

  SELECT count(*) INTO offenders
  FROM (
    SELECT "organization_id", "part_id", SUM("quantity") AS total
    FROM "stock_item"
    GROUP BY "organization_id", "part_id"
  ) grouped
  WHERE grouped.total < 0 OR grouped.total >= 1000000000000000;
  IF offenders > 0 THEN
    RAISE EXCEPTION 'aggregate stock balances are negative or exceed DECIMAL(20,5) (% groups)', offenders;
  END IF;
END $$;

ALTER TABLE "part" ADD COLUMN "stock" DECIMAL(20,5) NOT NULL DEFAULT 0;

UPDATE "part" AS p
SET "stock" = grouped.total
FROM (
  SELECT "organization_id", "part_id", SUM("quantity") AS total
  FROM "stock_item"
  GROUP BY "organization_id", "part_id"
) AS grouped
WHERE p."organization_id" = grouped."organization_id"
  AND p."id" = grouped."part_id";

ALTER TABLE "part" ADD CONSTRAINT "part_stock_check" CHECK ("stock" >= 0);

-- Aggregate item history.
CREATE TABLE "item_tracking" (
  "id" SERIAL NOT NULL,
  "organization_id" TEXT NOT NULL,
  "item_id" INTEGER,
  "tracking_type" INTEGER NOT NULL,
  "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" VARCHAR(512),
  "user_id" TEXT,
  "deltas" JSONB,
  "quantity_before" DECIMAL(20,5),
  "quantity_after" DECIMAL(20,5),

  CONSTRAINT "item_tracking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_tracking_organization_id_item_id_date_idx"
  ON "item_tracking"("organization_id", "item_id", "date");

ALTER TABLE "item_tracking" ADD CONSTRAINT "item_tracking_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "item_tracking" ADD CONSTRAINT "item_tracking_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "item_tracking" ADD CONSTRAINT "item_tracking_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Copy every recorded historic event. Old item_id was a lot; old part_id was
-- the material. Prefer the explicit part link and fall back to the lot's part.
INSERT INTO "item_tracking" (
  "id", "organization_id", "item_id", "tracking_type", "date",
  "notes", "user_id", "deltas", "quantity_before", "quantity_after"
)
SELECT
  st."id",
  st."organization_id",
  COALESCE(
    (SELECT p."id" FROM "part" p
      WHERE p."id" = st."part_id" AND p."organization_id" = st."organization_id"),
    (SELECT si."part_id" FROM "stock_item" si
      WHERE si."id" = st."item_id" AND si."organization_id" = st."organization_id")
  ),
  st."tracking_type",
  st."date",
  st."notes",
  st."user_id",
  st."deltas",
  NULL,
  NULL
FROM "stock_item_tracking" st
ORDER BY st."id";

-- Explicit ids were inserted, so advance the sequence before baseline rows.
SELECT setval(
  pg_get_serial_sequence('item_tracking', 'id'),
  COALESCE((SELECT MAX("id") FROM "item_tracking"), 0) + 1,
  false
);

-- Record the initial aggregate balance for every item that had legacy lots.
INSERT INTO "item_tracking" (
  "organization_id", "item_id", "tracking_type", "notes",
  "quantity_before", "quantity_after"
)
SELECT
  grouped."organization_id",
  grouped."part_id",
  90,
  'Initial aggregate stock balance migrated from legacy stock items',
  NULL,
  p."stock"
FROM (
  SELECT "organization_id", "part_id"
  FROM "stock_item"
  GROUP BY "organization_id", "part_id"
) AS grouped
JOIN "part" p
  ON p."organization_id" = grouped."organization_id"
 AND p."id" = grouped."part_id"
ORDER BY grouped."organization_id", grouped."part_id";

-- Repoint recorded sales from lot identity to aggregate item identity.
ALTER TABLE "build_consumption" ADD COLUMN "item_ref" INTEGER;
ALTER TABLE "build_consumption" ADD COLUMN "item_id" INTEGER;

UPDATE "build_consumption" AS c
SET
  "item_ref" = bc."component_ref",
  "item_id" = p."id"
FROM "build_component" AS bc
LEFT JOIN "part" AS p
  ON p."id" = bc."component_id"
 AND p."organization_id" = bc."organization_id"
WHERE bc."organization_id" = c."organization_id"
  AND bc."id" = c."build_component_id";

DO $$
DECLARE
  offenders BIGINT;
BEGIN
  SELECT count(*) INTO offenders FROM "build_consumption" WHERE "item_ref" IS NULL;
  IF offenders > 0 THEN
    RAISE EXCEPTION 'build_consumption rows cannot resolve an item reference (% rows)', offenders;
  END IF;
END $$;

ALTER TABLE "build_consumption" ALTER COLUMN "item_ref" SET NOT NULL;
ALTER TABLE "build_consumption"
  ALTER COLUMN "quantity" TYPE DECIMAL(20,5),
  ALTER COLUMN "quantity_before" TYPE DECIMAL(20,5),
  ALTER COLUMN "quantity_after" TYPE DECIMAL(20,5);

ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_access_open_identity_check";
ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_stock_item_id_fkey";
ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_stock_item_id_same_org_fkey";
ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_stock_location_id_fkey";
ALTER TABLE "build_consumption" DROP CONSTRAINT IF EXISTS "build_consumption_stock_location_id_same_org_fkey";

DROP INDEX IF EXISTS "build_consumption_stock_item_id_idx";
DROP INDEX IF EXISTS "build_consumption_stock_location_id_idx";
DROP INDEX IF EXISTS "build_consumption_access_open_idx";
DROP INDEX IF EXISTS "build_consumption_access_user_id_idx";
DROP INDEX IF EXISTS "build_consumption_access_team_id_idx";

ALTER TABLE "build_consumption"
  DROP COLUMN "stock_item_ref",
  DROP COLUMN "stock_item_id",
  DROP COLUMN "stock_serial",
  DROP COLUMN "stock_batch",
  DROP COLUMN "stock_expiry_date",
  DROP COLUMN "stock_location_id",
  DROP COLUMN "stock_location_name",
  DROP COLUMN "stock_location_path",
  DROP COLUMN "supplier_id",
  DROP COLUMN "supplier_name",
  DROP COLUMN "stock_deleted",
  DROP COLUMN "access_open",
  DROP COLUMN "access_user_id",
  DROP COLUMN "access_team_id";

CREATE INDEX "build_consumption_item_id_idx" ON "build_consumption"("item_id");

ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- The retired lot table no longer backs any live model. The archived test
-- result table keeps its rows; only its stock_item foreign keys are removed.
ALTER TABLE "stock_item_test_result" DROP CONSTRAINT IF EXISTS "stock_item_test_result_stock_item_id_fkey";
ALTER TABLE "stock_item_test_result" DROP CONSTRAINT IF EXISTS "stock_item_test_result_organization_id_stock_item_id_fkey";

DROP TABLE "stock_item_tracking";
DROP TABLE "stock_item";

COMMIT;
