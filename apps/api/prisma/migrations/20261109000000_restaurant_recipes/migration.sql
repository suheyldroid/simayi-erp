-- Move recipes off assemblies and bills of materials and onto an independent
-- restaurant recipe resource. This file is a forward migration. It does not
-- record that it was applied. Apply it in a maintenance window after a backup,
-- with all writers stopped; do not run it through `prisma migrate dev` in an
-- environment that still has the old writers running.
--
-- Data preservation: this script creates two tables and never drops, renames,
-- or deletes a table, row, or historical column. bom_item and
-- bom_item_substitute keep every row, foreign key, index, and value; the
-- application archives them with Prisma @@ignore. Part.assembly, Part.component,
-- Part.bom_validated, Part.bom_checksum, Part.bom_checked_by_id, and
-- Part.bom_checked_date stay physically present with their historical values;
-- only DB defaults are added so new item inserts that omit them succeed.
-- Retired build/build_component snapshot columns stay populated for history;
-- the ones without a default become nullable so the new sale writer can omit
-- them, while defaulted snapshots keep their NOT NULL default.
--
-- Backfill:
--   * one Recipe per legacy assembly part (and per part owning bom rows or
--     referenced by a historical sale), reusing the Part id so historical
--     requested ids can be rewired without losing facts. Names, descriptions,
--     active flags, and versions are preserved. Each sequence is reset.
--   * one RecipeLine per simple bom_item row, reusing the BomItem id so the
--     historical BuildComponent recipe line refs can point at the new table.
--   * build.requested_recipe_id/recipe_id/recipe_name/recipe_version are
--     populated from the matching legacy snapshot, and
--     build_component.recipe_line_id is repointed at the new table. The new
--     build_component.note keeps its empty default for history because sales
--     never snapshotted a line note. Immutable snapshot columns
--     (requested_recipe_id, recipe_name, recipe_version, recipe_line_ref,
--     component_ref) keep the historical value even when the live FK later
--     becomes null.
--
-- Fail-safe precondition: the guard below aborts the whole transaction before
-- any backfill when a legacy BOM row cannot be represented exactly as
-- "ingredient quantity x sold quantity". That covers optional components,
-- inherited/template recipes, allowed variant substitution, nonzero setup
-- quantity, nonzero attrition, any rounding multiple, multipart piece counts,
-- non-positive quantities, duplicate ingredients, and non-stockable
-- ingredients (virtual or template items). The error names the offending
-- bom_item ids so the precondition can be fixed before retrying. Nothing is
-- approximated and no row is discarded.
--
-- This script has not been executed against any database by this change.

BEGIN;

LOCK TABLE "part", "bom_item", "bom_item_substitute", "build",
  "build_component", "build_consumption"
  IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."optional";
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % are optional components, which cannot be represented as mandatory recipe ingredients. Clear the optional flag or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."inherited";
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % are inherited template lines, and the independent recipe model has no inheritance. Clear the inherited flag or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."allow_variants";
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % allow variant substitutes, but a recipe line must reference one exact item. Clear the flag or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."setup_quantity" <> 0;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % have a nonzero setup_quantity, which quantity x sold quantity cannot represent. Clear the setup quantity or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."attrition" <> 0;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % have nonzero attrition, which quantity x sold quantity cannot represent. Clear the attrition or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."rounding_multiple" IS NOT NULL;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % have a rounding multiple, which quantity x sold quantity cannot represent. Remove the rounding multiple or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."piece_count" <> 1;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % have a piece_count other than 1, which quantity x sold quantity cannot represent. Reset the piece count or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  WHERE b."quantity" <= 0;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % have a non-positive quantity, but recipe ingredient quantities must be greater than zero. Fix the quantity or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  JOIN "part" p
    ON p."organization_id" = b."organization_id" AND p."id" = b."part_id"
  WHERE p."is_template";
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % belong to template parts, whose recipe lines are inherited by variants. The independent recipe model has no template chain. Archive these template BOM rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(b."id"::text, ', ' ORDER BY b."id")
  INTO offenders
  FROM "bom_item" b
  JOIN "part" p
    ON p."organization_id" = b."organization_id" AND p."id" = b."sub_part_id"
  WHERE p."virtual" OR p."is_template";
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: legacy bom_item id(s) % use a virtual or template ingredient, which cannot be a stockable recipe ingredient. Replace the ingredient or archive these rows before migrating.',
      offenders;
  END IF;

  SELECT string_agg(
    format('part %s ingredient %s', duplicate."part_id", duplicate."sub_part_id"),
    '; '
    ORDER BY duplicate."part_id", duplicate."sub_part_id"
  )
  INTO offenders
  FROM (
    SELECT b."part_id", b."sub_part_id"
    FROM "bom_item" b
    GROUP BY b."part_id", b."sub_part_id"
    HAVING count(*) > 1
  ) duplicate;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Recipe migration aborted: duplicate legacy BOM ingredient rows cannot be represented because a recipe has one line per item (%). Merge the duplicate quantities or archive these rows before migrating.',
      offenders;
  END IF;
END
$$;

-- Independent recipe resource -------------------------------------------------

CREATE TABLE "recipe" (
    "id" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_name_not_blank_check" CHECK (btrim("name") <> ''),
    CONSTRAINT "recipe_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "recipe_line" (
    "id" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,5) NOT NULL,
    "note" VARCHAR(500) NOT NULL DEFAULT '',

    CONSTRAINT "recipe_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_line_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "recipe_organization_id_id_key" ON "recipe"("organization_id", "id");
CREATE INDEX "recipe_organization_id_name_idx" ON "recipe"("organization_id", "name");
CREATE INDEX "recipe_organization_id_active_id_idx" ON "recipe"("organization_id", "active", "id");

CREATE UNIQUE INDEX "recipe_line_organization_id_id_key" ON "recipe_line"("organization_id", "id");
CREATE UNIQUE INDEX "recipe_line_recipe_id_item_id_key" ON "recipe_line"("recipe_id", "item_id");
CREATE INDEX "recipe_line_organization_id_recipe_id_id_idx" ON "recipe_line"("organization_id", "recipe_id", "id");
CREATE INDEX "recipe_line_item_id_idx" ON "recipe_line"("item_id");

ALTER TABLE "recipe" ADD CONSTRAINT "recipe_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "recipe_line" ADD CONSTRAINT "recipe_line_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "recipe_line" ADD CONSTRAINT "recipe_line_organization_id_recipe_id_fkey"
  FOREIGN KEY ("organization_id", "recipe_id") REFERENCES "recipe"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "recipe_line" ADD CONSTRAINT "recipe_line_organization_id_item_id_fkey"
  FOREIGN KEY ("organization_id", "item_id") REFERENCES "part"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Backfill simple legacy recipes ----------------------------------------------

INSERT INTO "recipe" (
  "id", "organization_id", "name", "description", "active", "version",
  "created_at", "updated_at"
)
SELECT
  p."id",
  p."organization_id",
  p."name",
  p."description",
  p."active",
  p."version",
  COALESCE(p."creation_date"::timestamptz, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "part" p
WHERE p."assembly"
   OR EXISTS (
     SELECT 1
     FROM "bom_item" b
     WHERE b."organization_id" = p."organization_id" AND b."part_id" = p."id"
   )
   OR EXISTS (
     SELECT 1
     FROM "build" bd
     WHERE bd."organization_id" = p."organization_id"
       AND bd."requested_item_id" = p."id"
   )
ORDER BY p."id";

INSERT INTO "recipe_line" (
  "id", "organization_id", "recipe_id", "item_id", "quantity", "note"
)
SELECT
  b."id",
  b."organization_id",
  b."part_id",
  b."sub_part_id",
  b."quantity",
  b."note"
FROM "bom_item" b
JOIN "recipe" r
  ON r."organization_id" = b."organization_id" AND r."id" = b."part_id"
ORDER BY b."id";

-- Reusing Part and BomItem ids keeps historical sale references meaningful;
-- the sequences must continue past every preserved historical id, including
-- references whose original Part or BomItem row has since been deleted. The
-- immutable snapshots keep those ids; requested_item_id is the equivalent
-- historical source before requested_recipe_id is added below.
SELECT setval(
  pg_get_serial_sequence('recipe', 'id'),
  GREATEST(
    COALESCE((SELECT max("id") FROM "recipe"), 0),
    COALESCE((SELECT max("requested_item_id") FROM "build"), 0)
  ) + 1,
  false
);
SELECT setval(
  pg_get_serial_sequence('recipe_line', 'id'),
  GREATEST(
    COALESCE((SELECT max("id") FROM "recipe_line"), 0),
    COALESCE((SELECT max("recipe_line_ref") FROM "build_component"), 0)
  ) + 1,
  false
);

-- Archive part flags while keeping historical values --------------------------

ALTER TABLE "part" ALTER COLUMN "assembly" SET DEFAULT false;
ALTER TABLE "part" ALTER COLUMN "component" SET DEFAULT true;

-- Recorded sales: active recipe snapshot columns ------------------------------

ALTER TABLE "build"
  ADD COLUMN "requested_recipe_id" INTEGER,
  ADD COLUMN "recipe_id" INTEGER,
  ADD COLUMN "recipe_name" VARCHAR(100),
  ADD COLUMN "recipe_version" INTEGER;

UPDATE "build" b
SET
  "requested_recipe_id" = b."requested_item_id",
  "recipe_name" = b."item_name",
  "recipe_version" = b."item_version";

UPDATE "build" b
SET "recipe_id" = r."id"
FROM "recipe" r
WHERE r."organization_id" = b."organization_id"
  AND r."id" = b."requested_item_id";

ALTER TABLE "build"
  ALTER COLUMN "requested_recipe_id" SET NOT NULL,
  ALTER COLUMN "recipe_name" SET NOT NULL,
  ALTER COLUMN "recipe_version" SET NOT NULL;

-- The legacy snapshot columns stay for history but new inserts omit them.
-- Columns without a default must become nullable; item_units keeps its empty
-- default and stays NOT NULL.
ALTER TABLE "build"
  ALTER COLUMN "requested_item_id" DROP NOT NULL,
  ALTER COLUMN "item_name" DROP NOT NULL,
  ALTER COLUMN "item_version" DROP NOT NULL,
  ALTER COLUMN "recipe_checksum" DROP NOT NULL;

CREATE INDEX "build_recipe_id_idx" ON "build"("recipe_id");
ALTER TABLE "build" ADD CONSTRAINT "build_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
-- The simple FK keeps ON DELETE SET NULL, which a composite FK cannot do for
-- the mandatory organization column; this deferred SQL-only constraint keeps
-- the old same-organization guarantee and checks the surviving link at commit.
ALTER TABLE "build" ADD CONSTRAINT "build_recipe_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "recipe_id") REFERENCES "recipe"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

-- Recorded sale ingredient snapshots -----------------------------------------

ALTER TABLE "build_component"
  ADD COLUMN "note" VARCHAR(500) NOT NULL DEFAULT '';

-- Every simple BomItem has a RecipeLine with the same id; only unmatched live
-- links become null while recipe_line_ref keeps the immutable historical ref.
UPDATE "build_component" c
SET "recipe_line_id" = NULL
WHERE c."recipe_line_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "recipe_line" rl
    WHERE rl."organization_id" = c."organization_id"
      AND rl."id" = c."recipe_line_id"
  );

-- The historical sale never snapshotted a line note, so note keeps its empty
-- default for existing rows instead of asserting the current recipe note.

ALTER TABLE "build_component" DROP CONSTRAINT "build_component_recipe_line_id_fkey";
ALTER TABLE "build_component" DROP CONSTRAINT "build_component_recipe_line_id_same_org_fkey";
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_recipe_line_id_fkey"
  FOREIGN KEY ("recipe_line_id") REFERENCES "recipe_line"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_recipe_line_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "recipe_line_id") REFERENCES "recipe_line"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "build_component"
  ALTER COLUMN "assembly_item_ref" DROP NOT NULL,
  ALTER COLUMN "assembly_item_name" DROP NOT NULL,
  ALTER COLUMN "raw_amount" DROP NOT NULL,
  ALTER COLUMN "line_checksum" DROP NOT NULL;

COMMIT;
