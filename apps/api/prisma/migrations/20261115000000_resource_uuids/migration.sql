-- Resource UUID identity and immutable reference snapshots.
-- This file is a forward migration. It does not record that it was applied.
-- Apply it in a maintenance window with all writers stopped.
--
-- Scope:
--   * every application-owned Prisma model gains a database-generated random
--     UUIDv4 (`gen_random_uuid()`, NOT sequential UUIDv7) while keeping its
--     existing integer `id`, integer foreign keys, tenant composite uniques
--     and sequences exactly as they are;
--   * `webhook_message` keeps its original UUID values in a new `uuid` column
--     and gains a new integer autoincrement `id` (the old UUID `id` was the
--     only column carrying identity and no table referenced it);
--   * `build.requested_recipe_uuid`, `build_component.recipe_line_uuid_ref`,
--     `build_component.component_uuid_ref` and
--     `build_consumption.item_uuid_ref` are added as required immutable UUID
--     snapshots with NO foreign key;
--   * existing `item_tracking.deltas` numeric identity keys are rewritten to
--     UUID strings: buildId -> buildUuid, componentId -> itemUuid,
--     purchaseOrderId -> purchaseOrderUuid, lineId -> lineUuid. Non-identity
--     context (batch, old, new, quantity, buildReference) is preserved.
--
-- Historical resolution rules:
--   * a snapshot reference that still has a live row is resolved by the SAME
--     organization and the old integer id, never across tenants;
--   * a reference whose live row is gone receives ONE stable random UUID per
--     (organization, resource kind, old integer reference), shared by every
--     snapshot row that carries that same reference;
--   * no integer id is cast to a UUID, no UUID is derived deterministically,
--     no row is deleted, and no integer id or foreign key is remapped.
--
-- Temporary mapping tables are session-local and ON COMMIT DROP only; no
-- archive or backup table is created. This script has not been executed
-- against any database by this change.

BEGIN;

-- Deferrable INITIALLY DEFERRED same-organization foreign keys queue AFTER
-- constraint-trigger events on UPDATE even when the update does not touch the
-- key columns, and PostgreSQL refuses ALTER TABLE on a relation with pending
-- trigger events. Make every deferrable constraint immediate for this
-- transaction so its checks run at the end of each statement instead of at
-- COMMIT. Constraints stay fully enforced; nothing is disabled, dropped or
-- split out of this atomic transaction, and no upgrade path is invented.
SET CONSTRAINTS ALL IMMEDIATE;

-- 1. UUID columns on application-owned models (native Better Auth user,
--    session, account, verification, organization, member, invitation, team
--    and team_member identifiers stay framework-owned opaque strings).

ALTER TABLE "owner" ADD COLUMN "uuid" UUID;
UPDATE "owner" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "owner"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "owner_uuid_key" ON "owner" ("uuid");

ALTER TABLE "model_type" ADD COLUMN "uuid" UUID;
UPDATE "model_type" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "model_type"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "model_type_uuid_key" ON "model_type" ("uuid");

ALTER TABLE "user_profile" ADD COLUMN "uuid" UUID;
UPDATE "user_profile" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "user_profile"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "user_profile_uuid_key" ON "user_profile" ("uuid");

ALTER TABLE "supplier" ADD COLUMN "uuid" UUID;
UPDATE "supplier" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "supplier"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "supplier_uuid_key" ON "supplier" ("uuid");

ALTER TABLE "part_category" ADD COLUMN "uuid" UUID;
UPDATE "part_category" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "part_category"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "part_category_uuid_key" ON "part_category" ("uuid");

ALTER TABLE "part" ADD COLUMN "uuid" UUID;
UPDATE "part" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "part"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "part_uuid_key" ON "part" ("uuid");

ALTER TABLE "recipe" ADD COLUMN "uuid" UUID;
UPDATE "recipe" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "recipe"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "recipe_uuid_key" ON "recipe" ("uuid");

ALTER TABLE "recipe_line" ADD COLUMN "uuid" UUID;
UPDATE "recipe_line" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "recipe_line"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "recipe_line_uuid_key" ON "recipe_line" ("uuid");

ALTER TABLE "item_tracking" ADD COLUMN "uuid" UUID;
UPDATE "item_tracking" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "item_tracking"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "item_tracking_uuid_key" ON "item_tracking" ("uuid");

ALTER TABLE "purchase_order" ADD COLUMN "uuid" UUID;
UPDATE "purchase_order" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "purchase_order"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "purchase_order_uuid_key" ON "purchase_order" ("uuid");

ALTER TABLE "purchase_order_line_item" ADD COLUMN "uuid" UUID;
UPDATE "purchase_order_line_item" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "purchase_order_line_item"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "purchase_order_line_item_uuid_key" ON "purchase_order_line_item" ("uuid");

ALTER TABLE "purchase_order_extra_line" ADD COLUMN "uuid" UUID;
UPDATE "purchase_order_extra_line" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "purchase_order_extra_line"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "purchase_order_extra_line_uuid_key" ON "purchase_order_extra_line" ("uuid");

ALTER TABLE "build" ADD COLUMN "uuid" UUID;
UPDATE "build" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "build"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "build_uuid_key" ON "build" ("uuid");

ALTER TABLE "build_component" ADD COLUMN "uuid" UUID;
UPDATE "build_component" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "build_component"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "build_component_uuid_key" ON "build_component" ("uuid");

ALTER TABLE "build_consumption" ADD COLUMN "uuid" UUID;
UPDATE "build_consumption" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "build_consumption"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "build_consumption_uuid_key" ON "build_consumption" ("uuid");

ALTER TABLE "tag" ADD COLUMN "uuid" UUID;
UPDATE "tag" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "tag"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "tag_uuid_key" ON "tag" ("uuid");

ALTER TABLE "tagged_item" ADD COLUMN "uuid" UUID;
UPDATE "tagged_item" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "tagged_item"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "tagged_item_uuid_key" ON "tagged_item" ("uuid");

ALTER TABLE "selection_list" ADD COLUMN "uuid" UUID;
UPDATE "selection_list" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "selection_list"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "selection_list_uuid_key" ON "selection_list" ("uuid");

ALTER TABLE "selection_list_entry" ADD COLUMN "uuid" UUID;
UPDATE "selection_list_entry" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "selection_list_entry"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "selection_list_entry_uuid_key" ON "selection_list_entry" ("uuid");

ALTER TABLE "note" ADD COLUMN "uuid" UUID;
UPDATE "note" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "note"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "note_uuid_key" ON "note" ("uuid");

ALTER TABLE "notes_image" ADD COLUMN "uuid" UUID;
UPDATE "notes_image" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "notes_image"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "notes_image_uuid_key" ON "notes_image" ("uuid");

ALTER TABLE "attachment" ADD COLUMN "uuid" UUID;
UPDATE "attachment" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "attachment"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "attachment_uuid_key" ON "attachment" ("uuid");

ALTER TABLE "notification_entry" ADD COLUMN "uuid" UUID;
UPDATE "notification_entry" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "notification_entry"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "notification_entry_uuid_key" ON "notification_entry" ("uuid");

ALTER TABLE "notification_message" ADD COLUMN "uuid" UUID;
UPDATE "notification_message" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "notification_message"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "notification_message_uuid_key" ON "notification_message" ("uuid");

ALTER TABLE "webhook_endpoint" ADD COLUMN "uuid" UUID;
UPDATE "webhook_endpoint" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "webhook_endpoint"
  ALTER COLUMN "uuid" SET NOT NULL,
  ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "webhook_endpoint_uuid_key" ON "webhook_endpoint" ("uuid");

-- 2. webhook_message: the existing UUID primary key becomes `uuid` and a new
--    integer autoincrement primary key is introduced. Original UUID values are
--    preserved verbatim. No table references webhook_message.id.

DROP INDEX "webhook_message_organization_id_id_key";
ALTER TABLE "webhook_message" DROP CONSTRAINT "webhook_message_pkey";
ALTER TABLE "webhook_message" RENAME COLUMN "id" TO "uuid";
ALTER TABLE "webhook_message" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "webhook_message"
  ADD CONSTRAINT "webhook_message_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "webhook_message_uuid_key" ON "webhook_message" ("uuid");
CREATE UNIQUE INDEX "webhook_message_organization_id_id_key"
  ON "webhook_message" ("organization_id", "id");

-- 3. Temporary same-organization resolution maps. Each row maps one old
--    integer reference to the UUID of the live row, or to one stable random
--    UUID when the live row was deleted. ON COMMIT DROP only.

CREATE TEMP TABLE "_uuid_map_recipe" (
  organization_id TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  uuid UUID NOT NULL,
  PRIMARY KEY (organization_id, old_id)
) ON COMMIT DROP;

CREATE TEMP TABLE "_uuid_map_recipe_line" (
  organization_id TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  uuid UUID NOT NULL,
  PRIMARY KEY (organization_id, old_id)
) ON COMMIT DROP;

CREATE TEMP TABLE "_uuid_map_part" (
  organization_id TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  uuid UUID NOT NULL,
  PRIMARY KEY (organization_id, old_id)
) ON COMMIT DROP;

CREATE TEMP TABLE "_uuid_map_build" (
  organization_id TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  uuid UUID NOT NULL,
  PRIMARY KEY (organization_id, old_id)
) ON COMMIT DROP;

CREATE TEMP TABLE "_uuid_map_purchase_order" (
  organization_id TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  uuid UUID NOT NULL,
  PRIMARY KEY (organization_id, old_id)
) ON COMMIT DROP;

CREATE TEMP TABLE "_uuid_map_purchase_order_line" (
  organization_id TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  uuid UUID NOT NULL,
  PRIMARY KEY (organization_id, old_id)
) ON COMMIT DROP;

-- Live rows first: same organization + old integer id.
INSERT INTO "_uuid_map_recipe" (organization_id, old_id, uuid)
SELECT "organization_id", "id", "uuid" FROM "recipe";

INSERT INTO "_uuid_map_recipe_line" (organization_id, old_id, uuid)
SELECT "organization_id", "id", "uuid" FROM "recipe_line";

INSERT INTO "_uuid_map_part" (organization_id, old_id, uuid)
SELECT "organization_id", "id", "uuid" FROM "part";

INSERT INTO "_uuid_map_build" (organization_id, old_id, uuid)
SELECT "organization_id", "id", "uuid" FROM "build";

INSERT INTO "_uuid_map_purchase_order" (organization_id, old_id, uuid)
SELECT "organization_id", "id", "uuid" FROM "purchase_order";

INSERT INTO "_uuid_map_purchase_order_line" (organization_id, old_id, uuid)
SELECT "organization_id", "id", "uuid" FROM "purchase_order_line_item";

-- Deleted recipe references (build.requested_recipe_id).
INSERT INTO "_uuid_map_recipe" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT DISTINCT "organization_id", "requested_recipe_id" AS "old_id"
  FROM "build"
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_recipe" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- Deleted recipe-line references (build_component.recipe_line_ref).
INSERT INTO "_uuid_map_recipe_line" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT DISTINCT "organization_id", "recipe_line_ref" AS "old_id"
  FROM "build_component"
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_recipe_line" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- Deleted item references (build_component.component_ref,
-- build_consumption.item_ref). Both are Part ids and share one mapping per
-- (organization, Part, old integer reference).
INSERT INTO "_uuid_map_part" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT "organization_id", "component_ref" AS "old_id" FROM "build_component"
  UNION
  SELECT "organization_id", "item_ref" AS "old_id" FROM "build_consumption"
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_part" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- Deleted build references in item_tracking.deltas.
INSERT INTO "_uuid_map_build" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT DISTINCT "organization_id", ("deltas"->>'buildId')::INTEGER AS "old_id"
  FROM "item_tracking"
  WHERE "deltas" ? 'buildId'
    AND "deltas"->>'buildId' ~ '^[0-9]+$'
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_build" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- Deleted item references in item_tracking.deltas (componentId is a Part id).
INSERT INTO "_uuid_map_part" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT DISTINCT "organization_id", ("deltas"->>'componentId')::INTEGER AS "old_id"
  FROM "item_tracking"
  WHERE "deltas" ? 'componentId'
    AND "deltas"->>'componentId' ~ '^[0-9]+$'
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_part" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- Deleted purchase-order references in item_tracking.deltas.
INSERT INTO "_uuid_map_purchase_order" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT DISTINCT "organization_id", ("deltas"->>'purchaseOrderId')::INTEGER AS "old_id"
  FROM "item_tracking"
  WHERE "deltas" ? 'purchaseOrderId'
    AND "deltas"->>'purchaseOrderId' ~ '^[0-9]+$'
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_purchase_order" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- Deleted purchase-order-line references in item_tracking.deltas.
INSERT INTO "_uuid_map_purchase_order_line" (organization_id, old_id, uuid)
SELECT s."organization_id", s."old_id", gen_random_uuid()
FROM (
  SELECT DISTINCT "organization_id", ("deltas"->>'lineId')::INTEGER AS "old_id"
  FROM "item_tracking"
  WHERE "deltas" ? 'lineId'
    AND "deltas"->>'lineId' ~ '^[0-9]+$'
) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "_uuid_map_purchase_order_line" m
  WHERE m."organization_id" = s."organization_id"
    AND m."old_id" = s."old_id"
);

-- 4. Immutable UUID snapshots (no foreign key on any of these columns).

ALTER TABLE "build" ADD COLUMN "requested_recipe_uuid" UUID;
UPDATE "build" b
SET "requested_recipe_uuid" = m."uuid"
FROM "_uuid_map_recipe" m
WHERE m."organization_id" = b."organization_id"
  AND m."old_id" = b."requested_recipe_id";
ALTER TABLE "build" ALTER COLUMN "requested_recipe_uuid" SET NOT NULL;

ALTER TABLE "build_component" ADD COLUMN "recipe_line_uuid_ref" UUID;
UPDATE "build_component" c
SET "recipe_line_uuid_ref" = m."uuid"
FROM "_uuid_map_recipe_line" m
WHERE m."organization_id" = c."organization_id"
  AND m."old_id" = c."recipe_line_ref";
ALTER TABLE "build_component" ALTER COLUMN "recipe_line_uuid_ref" SET NOT NULL;

ALTER TABLE "build_component" ADD COLUMN "component_uuid_ref" UUID;
UPDATE "build_component" c
SET "component_uuid_ref" = m."uuid"
FROM "_uuid_map_part" m
WHERE m."organization_id" = c."organization_id"
  AND m."old_id" = c."component_ref";
ALTER TABLE "build_component" ALTER COLUMN "component_uuid_ref" SET NOT NULL;

ALTER TABLE "build_consumption" ADD COLUMN "item_uuid_ref" UUID;
UPDATE "build_consumption" c
SET "item_uuid_ref" = m."uuid"
FROM "_uuid_map_part" m
WHERE m."organization_id" = c."organization_id"
  AND m."old_id" = c."item_ref";
ALTER TABLE "build_consumption" ALTER COLUMN "item_uuid_ref" SET NOT NULL;

-- 5. item_tracking.deltas numeric identity keys -> UUID strings. One
--    statement per key so unmatched values can never be half-rewritten.

UPDATE "item_tracking" t
SET "deltas" = (t."deltas" - 'buildId')
  || jsonb_build_object('buildUuid', m."uuid"::TEXT)
FROM "_uuid_map_build" m
WHERE t."deltas" ? 'buildId'
  AND t."deltas"->>'buildId' ~ '^[0-9]+$'
  AND m."organization_id" = t."organization_id"
  AND m."old_id" = (t."deltas"->>'buildId')::INTEGER;

UPDATE "item_tracking" t
SET "deltas" = (t."deltas" - 'componentId')
  || jsonb_build_object('itemUuid', m."uuid"::TEXT)
FROM "_uuid_map_part" m
WHERE t."deltas" ? 'componentId'
  AND t."deltas"->>'componentId' ~ '^[0-9]+$'
  AND m."organization_id" = t."organization_id"
  AND m."old_id" = (t."deltas"->>'componentId')::INTEGER;

UPDATE "item_tracking" t
SET "deltas" = (t."deltas" - 'purchaseOrderId')
  || jsonb_build_object('purchaseOrderUuid', m."uuid"::TEXT)
FROM "_uuid_map_purchase_order" m
WHERE t."deltas" ? 'purchaseOrderId'
  AND t."deltas"->>'purchaseOrderId' ~ '^[0-9]+$'
  AND m."organization_id" = t."organization_id"
  AND m."old_id" = (t."deltas"->>'purchaseOrderId')::INTEGER;

UPDATE "item_tracking" t
SET "deltas" = (t."deltas" - 'lineId')
  || jsonb_build_object('lineUuid', m."uuid"::TEXT)
FROM "_uuid_map_purchase_order_line" m
WHERE t."deltas" ? 'lineId'
  AND t."deltas"->>'lineId' ~ '^[0-9]+$'
  AND m."organization_id" = t."organization_id"
  AND m."old_id" = (t."deltas"->>'lineId')::INTEGER;

-- 6. Fail closed if any identity key could not be rewritten.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "item_tracking"
    WHERE "deltas" ?| ARRAY['buildId', 'componentId', 'purchaseOrderId', 'lineId']
  ) THEN
    RAISE EXCEPTION
      'item_tracking.deltas contains unresolved numeric identity keys';
  END IF;
END $$;

COMMIT;
