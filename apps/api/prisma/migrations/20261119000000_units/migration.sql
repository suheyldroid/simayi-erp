-- Organization-scoped unit catalog and historical unit snapshots.
-- Forward migration; it does not record that it was applied and it has not
-- been executed against any database by this change. Prisma does not wrap a
-- PostgreSQL migration in a transaction, so this file is one explicit
-- BEGIN/COMMIT block.
--
-- Data handling:
--   * every DISTINCT nonblank `part.units` label inside one organization
--     becomes exactly one `unit` row with that same text as both `name` and
--     `code`. Labels are preserved byte-for-byte; no alias, spelling, case or
--     conversion is interpreted (for example "kilogram" stays "kilogram" and
--     never becomes "kg").
--   * NULL and blank (`btrim(units) = ''`) labels become `part.unit_id = NULL`
--     and therefore stay explicitly unresolved; no replacement unit is picked.
--   * `item_tracking.unit_code` and `purchase_order_line_item.unit_code` are
--     added nullable and are NOT backfilled. The unit that a past movement or
--     order line used is unknown, so writing today's item unit into history
--     would fabricate a fact. Existing sales snapshots
--     (`build_component.component_units`) are untouched.
--   * `part.units` is dropped only after every label has been mapped, so no
--     stored free text is lost.
--
-- Deployment: apply with all writers stopped, then start the code that reads
-- `part.unit_id` and the unit relation.

BEGIN;

LOCK TABLE "part", "item_tracking", "purchase_order_line_item"
  IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "unit" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "unit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "unit_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "unit_uuid_key" ON "unit"("uuid");
CREATE UNIQUE INDEX "unit_organization_id_code_key"
  ON "unit"("organization_id", "code");
CREATE UNIQUE INDEX "unit_organization_id_id_key"
  ON "unit"("organization_id", "id");
CREATE INDEX "unit_organization_id_active_id_idx"
  ON "unit"("organization_id", "active", "id");

-- One unit per exact stored label per organization. The label is the code.
INSERT INTO "unit" ("organization_id", "name", "code")
SELECT DISTINCT
  p."organization_id",
  p."units",
  p."units"
FROM "part" AS p
WHERE p."units" IS NOT NULL AND btrim(p."units") <> '';

ALTER TABLE "part" ADD COLUMN "unit_id" INTEGER;

UPDATE "part" AS p
SET "unit_id" = u."id"
FROM "unit" AS u
WHERE u."organization_id" = p."organization_id"
  AND u."code" = p."units"
  AND p."units" IS NOT NULL
  AND btrim(p."units") <> '';

ALTER TABLE "part"
  ADD CONSTRAINT "part_organization_id_unit_id_fkey"
  FOREIGN KEY ("organization_id", "unit_id")
  REFERENCES "unit"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "part_unit_id_idx" ON "part"("unit_id");

ALTER TABLE "part" DROP COLUMN "units";

ALTER TABLE "item_tracking" ADD COLUMN "unit_code" VARCHAR(20);
ALTER TABLE "purchase_order_line_item" ADD COLUMN "unit_code" VARCHAR(20);

COMMIT;
