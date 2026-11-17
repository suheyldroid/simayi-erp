-- Replace factory build orders with immutable restaurant preparation records.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window after a backup, with writers stopped.
--
-- A build now means: prepare a recipe quantity, deduct its ingredient stock,
-- and keep a permanent snapshot. No finished-goods stock is produced, no
-- quantities are reserved for other builds, and no customer is involved.
--
-- Legacy safety gate. Exact conversion from a pending factory build into a
-- completed preparation is impossible because that would claim work was done
-- and would re-consume stock. This script therefore refuses to run when any
-- legacy build, line, allocation/output linkage, or generic buildline/builditem
-- reference exists. The database is left unchanged in that case. Operators must
-- archive or discard those rows explicitly, then retry. Verified empty or
-- convertible state is the only state this script drops.
--
-- When the gate passes:
--   * build_line, build_item, and the old build table are dropped.
--   * stock_item.build_id, consumed_by_id, and is_building are dropped so no
--     reservation or factory output link remains. Stock quantities are not
--     changed. stock_item.customer_id stays for unrelated owned-stock history.
--   * new tables build_component and build_consumption store the recipe and
--     stock-lot snapshots. Their stock/location/item links are nullable with
--     ON DELETE SET NULL so deleting catalog, stock, or location rows keeps
--     completed preparation history readable.
--   * the exact ('build','buildline') and ('build','builditem') registry rows
--     are deleted after dependent generic rows are proven absent. The
--     ('build','build') row stays because builds remain a real model.
--
-- Attachment.model_type is a free string. The attachment table is empty in the
-- verified database, and this script only refuses when its values name the
-- removed factory child models. It never deletes unrelated attachment rows.

BEGIN;

LOCK TABLE "build", "build_line", "build_item", "stock_item", "model_type",
  "attachment", "tagged_item", "note", "notification_message", "parameter",
  "parameter_template", "part", "stock_location", "bom_item", "user", "team",
  "organization"
  IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  legacy_builds BIGINT;
  legacy_stock BIGINT;
  registry_refs BIGINT;
BEGIN
  SELECT
    (SELECT count(*) FROM "build") +
    (SELECT count(*) FROM "build_line") +
    (SELECT count(*) FROM "build_item")
  INTO legacy_builds;
  IF legacy_builds > 0 THEN
    RAISE EXCEPTION
      'build preparation cutover refused: % legacy build rows exist. Archive or resolve factory builds before retrying; this script will not invent completed preparations from them.',
      legacy_builds;
  END IF;

  SELECT count(*) INTO legacy_stock
  FROM "stock_item"
  WHERE "build_id" IS NOT NULL
     OR "consumed_by_id" IS NOT NULL
     OR "is_building" = true;
  IF legacy_stock > 0 THEN
    RAISE EXCEPTION
      'build preparation cutover refused: % legacy stock rows still carry build output, consumption, or in-production flags. Archive those rows before retrying; stock quantities are never silently rewritten.',
      legacy_stock;
  END IF;

  SELECT count(*) INTO registry_refs
  FROM (
    SELECT 1
    FROM "tagged_item" AS row
    JOIN "model_type" AS type ON type."id" = row."content_type_id"
    WHERE type."app_label" = 'build' AND type."model" IN ('buildline', 'builditem')
    UNION ALL
    SELECT 1
    FROM "note" AS row
    JOIN "model_type" AS type ON type."id" = row."model_type_id"
    WHERE type."app_label" = 'build' AND type."model" IN ('buildline', 'builditem')
    UNION ALL
    SELECT 1
    FROM "notification_message" AS row
    JOIN "model_type" AS type ON type."id" = row."target_content_type_id"
    WHERE type."app_label" = 'build' AND type."model" IN ('buildline', 'builditem')
    UNION ALL
    SELECT 1
    FROM "notification_message" AS row
    JOIN "model_type" AS type ON type."id" = row."source_content_type_id"
    WHERE type."app_label" = 'build' AND type."model" IN ('buildline', 'builditem')
    UNION ALL
    SELECT 1
    FROM "parameter" AS row
    JOIN "model_type" AS type ON type."id" = row."model_type_id"
    WHERE type."app_label" = 'build' AND type."model" IN ('buildline', 'builditem')
    UNION ALL
    SELECT 1
    FROM "parameter_template" AS row
    JOIN "model_type" AS type ON type."id" = row."model_type_id"
    WHERE type."app_label" = 'build' AND type."model" IN ('buildline', 'builditem')
  ) AS refs;
  IF registry_refs > 0 THEN
    RAISE EXCEPTION
      'build preparation cutover refused: % notes, tags, notifications, or parameters still reference the removed buildline/builditem registry rows. Archive those rows before retrying.',
      registry_refs;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "attachment"
    WHERE lower("model_type") IN (
      'buildline',
      'builditem',
      'build.line',
      'build.item',
      'build.buildline',
      'build.builditem'
    )
  ) THEN
    RAISE EXCEPTION
      'build preparation cutover refused: attachments still name the removed buildline/builditem models. This script does not guess-delete generic attachment data.';
  END IF;
END $$;

-- Remove the obsolete output and reservation links before the old build table.
ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_build_id_same_org_fkey";
ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_build_id_fkey";
ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_organization_id_consumed_by_id_fkey";
DROP INDEX "stock_item_build_id_idx";
DROP INDEX "stock_item_consumed_by_id_idx";
ALTER TABLE "stock_item" DROP COLUMN "build_id";
ALTER TABLE "stock_item" DROP COLUMN "consumed_by_id";
ALTER TABLE "stock_item" DROP COLUMN "is_building";

DROP TABLE "build_item";
DROP TABLE "build_line";
DROP TABLE "build";

CREATE TABLE "build" (
    "id" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "reference_int" BIGINT NOT NULL DEFAULT 0,
    "request_key" VARCHAR(100) NOT NULL,
    "requested_item_id" INTEGER NOT NULL,
    "requested_source_location_id" INTEGER NOT NULL,
    "item_id" INTEGER,
    "item_name" VARCHAR(100) NOT NULL,
    "item_ipn" VARCHAR(100),
    "item_units" VARCHAR(20) NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "source_location_id" INTEGER,
    "source_location_name" VARCHAR(100) NOT NULL,
    "source_location_path" TEXT NOT NULL DEFAULT '',
    "recipe_checksum" VARCHAR(128) NOT NULL,
    "recipe_checked_by_id" TEXT,
    "recipe_checked_date" DATE,
    "item_version" INTEGER NOT NULL,
    "component_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,

    CONSTRAINT "build_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "build_quantity_check" CHECK ("quantity" >= 1),
    CONSTRAINT "build_item_version_check" CHECK ("item_version" >= 0),
    CONSTRAINT "build_component_count_check" CHECK ("component_count" >= 0)
);

CREATE UNIQUE INDEX "build_organization_id_id_key" ON "build"("organization_id", "id");
CREATE UNIQUE INDEX "build_organization_id_reference_key" ON "build"("organization_id", "reference");
CREATE UNIQUE INDEX "build_organization_id_request_key_key" ON "build"("organization_id", "request_key");
CREATE INDEX "build_item_id_idx" ON "build"("item_id");
CREATE INDEX "build_source_location_id_idx" ON "build"("source_location_id");
CREATE INDEX "build_created_by_id_idx" ON "build"("created_by_id");

CREATE TABLE "build_component" (
    "id" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "build_id" INTEGER NOT NULL,
    "recipe_line_ref" INTEGER NOT NULL,
    "assembly_item_ref" INTEGER NOT NULL,
    "component_ref" INTEGER NOT NULL,
    "recipe_line_id" INTEGER,
    "assembly_item_id" INTEGER,
    "assembly_item_name" VARCHAR(100) NOT NULL,
    "component_id" INTEGER,
    "component_name" VARCHAR(100) NOT NULL,
    "component_ipn" VARCHAR(100),
    "component_units" VARCHAR(20) NOT NULL DEFAULT '',
    "reference" VARCHAR(5000) NOT NULL DEFAULT '',
    "raw_amount" VARCHAR(25) NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "recipe_quantity" DECIMAL(15,5) NOT NULL,
    "required_quantity" DECIMAL(15,5) NOT NULL,
    "consumed_quantity" DECIMAL(15,5) NOT NULL,
    "piece_count" INTEGER NOT NULL DEFAULT 1,
    "attrition" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "setup_quantity" DECIMAL(15,5) NOT NULL DEFAULT 0,
    "rounding_multiple" DECIMAL(15,5),
    "line_checksum" VARCHAR(128) NOT NULL,

    CONSTRAINT "build_component_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "build_component_required_quantity_check" CHECK ("required_quantity" >= 0),
    CONSTRAINT "build_component_consumed_quantity_check" CHECK ("consumed_quantity" >= 0),
    CONSTRAINT "build_component_piece_count_check" CHECK ("piece_count" >= 1),
    CONSTRAINT "build_component_attrition_check" CHECK ("attrition" >= 0 AND "attrition" <= 100),
    CONSTRAINT "build_component_setup_quantity_check" CHECK ("setup_quantity" >= 0)
);

CREATE UNIQUE INDEX "build_component_organization_id_id_key" ON "build_component"("organization_id", "id");
CREATE UNIQUE INDEX "build_component_organization_id_build_id_id_key" ON "build_component"("organization_id", "build_id", "id");
CREATE INDEX "build_component_build_id_idx" ON "build_component"("build_id");
CREATE INDEX "build_component_recipe_line_id_idx" ON "build_component"("recipe_line_id");
CREATE INDEX "build_component_component_id_idx" ON "build_component"("component_id");
CREATE INDEX "build_component_assembly_item_id_idx" ON "build_component"("assembly_item_id");

CREATE TABLE "build_consumption" (
    "id" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "build_id" INTEGER NOT NULL,
    "build_component_id" INTEGER NOT NULL,
    "stock_item_ref" INTEGER NOT NULL,
    "stock_item_id" INTEGER,
    "stock_serial" VARCHAR(100),
    "stock_batch" VARCHAR(100),
    "stock_expiry_date" DATE,
    "stock_location_id" INTEGER,
    "stock_location_name" VARCHAR(100) NOT NULL,
    "stock_location_path" TEXT NOT NULL DEFAULT '',
    "supplier_id" INTEGER,
    "supplier_name" VARCHAR(100),
    "quantity" DECIMAL(15,5) NOT NULL,
    "quantity_before" DECIMAL(15,5) NOT NULL,
    "quantity_after" DECIMAL(15,5) NOT NULL,
    "stock_deleted" BOOLEAN NOT NULL DEFAULT false,
    "access_open" BOOLEAN NOT NULL DEFAULT false,
    "access_user_id" TEXT,
    "access_team_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,

    CONSTRAINT "build_consumption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "build_consumption_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "build_consumption_quantity_before_check" CHECK ("quantity_before" >= 0),
    CONSTRAINT "build_consumption_quantity_after_check" CHECK ("quantity_after" >= 0),
    CONSTRAINT "build_consumption_access_open_identity_check" CHECK ("access_open" = false OR ("access_user_id" IS NULL AND "access_team_id" IS NULL))
);

CREATE UNIQUE INDEX "build_consumption_organization_id_id_key" ON "build_consumption"("organization_id", "id");
CREATE INDEX "build_consumption_build_id_idx" ON "build_consumption"("build_id");
CREATE INDEX "build_consumption_build_component_id_idx" ON "build_consumption"("build_component_id");
CREATE INDEX "build_consumption_stock_item_id_idx" ON "build_consumption"("stock_item_id");
CREATE INDEX "build_consumption_stock_location_id_idx" ON "build_consumption"("stock_location_id");
CREATE INDEX "build_consumption_created_by_id_idx" ON "build_consumption"("created_by_id");
CREATE INDEX "build_consumption_access_open_idx" ON "build_consumption"("access_open");
CREATE INDEX "build_consumption_access_user_id_idx" ON "build_consumption"("access_user_id");
CREATE INDEX "build_consumption_access_team_id_idx" ON "build_consumption"("access_team_id");

ALTER TABLE "build" ADD CONSTRAINT "build_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_source_location_id_fkey"
  FOREIGN KEY ("source_location_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_item_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "item_id") REFERENCES "part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build" ADD CONSTRAINT "build_source_location_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "source_location_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "build_component" ADD CONSTRAINT "build_component_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_organization_id_build_id_fkey"
  FOREIGN KEY ("organization_id", "build_id") REFERENCES "build"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_recipe_line_id_fkey"
  FOREIGN KEY ("recipe_line_id") REFERENCES "bom_item"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_assembly_item_id_fkey"
  FOREIGN KEY ("assembly_item_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_component_id_fkey"
  FOREIGN KEY ("component_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_recipe_line_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "recipe_line_id") REFERENCES "bom_item"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_assembly_item_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "assembly_item_id") REFERENCES "part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build_component" ADD CONSTRAINT "build_component_component_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "component_id") REFERENCES "part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_organization_id_build_id_fkey"
  FOREIGN KEY ("organization_id", "build_id") REFERENCES "build"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_organization_id_build_component_id_fkey"
  FOREIGN KEY ("organization_id", "build_component_id") REFERENCES "build_component"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
-- The mandatory component link is same-org in Prisma. This extra SQL-only
-- constraint also proves the row belongs to the same build.
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_organization_id_build_id_build_component_id_fkey"
  FOREIGN KEY ("organization_id", "build_id", "build_component_id") REFERENCES "build_component"("organization_id", "build_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_stock_item_id_fkey"
  FOREIGN KEY ("stock_item_id") REFERENCES "stock_item"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_stock_location_id_fkey"
  FOREIGN KEY ("stock_location_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_access_user_id_fkey"
  FOREIGN KEY ("access_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_organization_id_access_team_id_fkey"
  FOREIGN KEY ("organization_id", "access_team_id") REFERENCES "team"("organizationId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_stock_item_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "stock_item_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build_consumption" ADD CONSTRAINT "build_consumption_stock_location_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "stock_location_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

-- Remove only the two factory child registry rows. The gate above proved that
-- no note, tag, notification, parameter, or parameter template references them.
-- The ('build','build') registry row stays because the build model remains.
DELETE FROM "model_type"
WHERE "app_label" = 'build' AND "model" IN ('buildline', 'builditem');

COMMIT;
