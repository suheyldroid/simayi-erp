-- Company/branch cutover: explicit branches, branch stock, branch recipes,
-- branch-scoped sales/POS and immutable purchase receipts.
-- Forward migration for the state produced by 20261201000000_recipe_nested_ingredients.
-- It does not record that it was applied and it has not been executed against
-- any database by this change. Prisma does not wrap a PostgreSQL migration in a
-- transaction, so this file is one explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * Every existing native organization stays the company; one initial branch
--     named after that organization is created for it. No organization is
--     merged, renamed or given a second/guessed branch.
--   * Existing Part.stock/minimum_stock values are copied exactly into that
--     initial branch's BranchStock (row created only when either value is
--     non-zero, because a missing row means exactly zero). Part.version is
--     left untouched (the catalog version); the copied balance version keeps
--     the old stock version so no client silently overwrites a stale balance.
--     Part.stock/minimum_stock are dropped only after the copy and after the
--     legacy receipt baseline backfill that reads them.
--   * Existing item_tracking, sales, sales batches, product mappings, POS
--     devices, builds and purchase orders are attributed to the initial branch
--     to preserve the previous single-location behavior. Existing recipes
--     become branch-local definitions of that branch (source null), keeping
--     their ids, UUIDs, versions, lines and nested graph unchanged, so no sale
--     snapshot, build component or historical reference is rewritten.
--   * Purchase orders keep org-wide references and get the initial branch as
--     origin. Receipt destination branches are new rows only.
--   * Historic received quantities cannot be reconstructed as events: one
--     legacy baseline PurchaseReceipt per line with received <> 0 records the
--     aggregate order quantity, marked legacy_baseline, with unknown stock
--     quantity, price, discount, currency, actor, request key and time kept
--     NULL. No value is invented.
--   * receipt totals on purchase_order_line_item.received, currency codes,
--     immutable UUID snapshots, ledger rows and finance currency are never
--     rewritten.
--
-- Deployment: stop every API writer, back up the database, apply this
-- migration, then start the branch-aware API. No organization consolidation or
-- data repair is performed automatically.

BEGIN;

LOCK TABLE "organization", "part", "recipe", "item_tracking", "purchase_order",
  "purchase_order_line_item", "build", "sales_batch", "sales_product_mapping",
  "pos_device", "pos_device_z_report"
  IN ACCESS EXCLUSIVE MODE;

-- Preflight: fail before any change when legacy data cannot be cut over.
DO $$
DECLARE dependents TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "part" WHERE "stock" < 0 OR "minimum_stock" < 0) THEN
    RAISE EXCEPTION 'part contains negative stock or minimum stock; reconcile it before the branch cutover';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "organization"
    WHERE btrim("name") = '' OR char_length("name") > 100
  ) THEN
    RAISE EXCEPTION 'every organization name must be 1..100 characters because it becomes the initial branch name; fix the native organization name first (it is not rewritten by this migration)';
  END IF;

  IF EXISTS (SELECT 1 FROM "purchase_order_line_item" WHERE "received" < 0) THEN
    RAISE EXCEPTION 'purchase_order_line_item contains a negative received quantity; reconcile it before the branch cutover';
  END IF;

  SELECT string_agg(DISTINCT c.relname, ', ') INTO dependents
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class c ON c.oid = r.ev_class
  JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
  WHERE d.classid = 'pg_rewrite'::regclass
    AND d.refobjid = 'part'::regclass
    AND a.attname IN ('stock', 'minimum_stock');
  IF dependents IS NOT NULL THEN
    RAISE EXCEPTION 'views depend on part.stock/minimum_stock (%); redefine them before the cutover', dependents;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'part'::regclass AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'part has user-defined triggers; audit them before dropping part.stock/minimum_stock';
  END IF;
END $$;

-- Branch registry.
CREATE TABLE "branch" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_uuid_key" ON "branch"("uuid");
CREATE INDEX "branch_organization_id_active_id_idx" ON "branch"("organization_id", "active", "id");
CREATE UNIQUE INDEX "branch_organization_id_id_key" ON "branch"("organization_id", "id");
CREATE UNIQUE INDEX "branch_organization_id_name_key" ON "branch"("organization_id", "name");

ALTER TABLE "branch" ADD CONSTRAINT "branch_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

INSERT INTO "branch" ("organization_id", "name", "updated_at")
SELECT o."id", o."name", CURRENT_TIMESTAMP
FROM "organization" o;

-- Exactly one initial branch per company.
DO $$
DECLARE missing INTEGER;
BEGIN
  SELECT count(*) INTO missing
  FROM "organization" o
  WHERE NOT EXISTS (SELECT 1 FROM "branch" b WHERE b."organization_id" = o."id");
  IF missing <> 0 THEN
    RAISE EXCEPTION 'initial branch creation missed % organizations', missing;
  END IF;
  IF (SELECT count(*) FROM "branch") <> (SELECT count(*) FROM "organization") THEN
    RAISE EXCEPTION 'initial branch creation produced more than one branch for some organization';
  END IF;
END $$;

-- Per-branch balances. The internal item id keeps company-wide catalog
-- identity; the ordered balance is exact and branch-versioned.
CREATE TABLE "branch_stock" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "stock" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "minimum_stock" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_stock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_stock_uuid_key" ON "branch_stock"("uuid");
CREATE INDEX "branch_stock_organization_id_item_id_idx" ON "branch_stock"("organization_id", "item_id");
CREATE UNIQUE INDEX "branch_stock_branch_id_item_id_key" ON "branch_stock"("branch_id", "item_id");

ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_organization_id_item_id_fkey"
  FOREIGN KEY ("organization_id", "item_id") REFERENCES "part"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_nonnegative_check"
  CHECK ("stock" >= 0 AND "minimum_stock" >= 0);

INSERT INTO "branch_stock" (
  "organization_id", "branch_id", "item_id", "stock", "minimum_stock", "version", "updated_at"
)
SELECT p."organization_id", b."id", p."id", p."stock", p."minimum_stock", p."version", CURRENT_TIMESTAMP
FROM "part" p
JOIN "branch" b ON b."organization_id" = p."organization_id"
WHERE p."stock" <> 0 OR p."minimum_stock" <> 0 OR p."version" <> 0;

DO $$
DECLARE
  copied INTEGER;
  expected INTEGER;
BEGIN
  SELECT count(*) INTO copied FROM "branch_stock";
  SELECT count(*) INTO expected
  FROM "part" WHERE "stock" <> 0 OR "minimum_stock" <> 0 OR "version" <> 0;
  IF copied <> expected THEN
    RAISE EXCEPTION 'branch balance copy missed rows: copied %, expected %', copied, expected;
  END IF;
END $$;

-- Branch activation of company recipes. Empty after this migration: every
-- existing recipe becomes a branch-local definition instead of a company root.
CREATE TABLE "branch_recipe" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_recipe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_recipe_uuid_key" ON "branch_recipe"("uuid");
CREATE INDEX "branch_recipe_recipe_id_idx" ON "branch_recipe"("recipe_id");
CREATE INDEX "branch_recipe_branch_id_active_id_idx" ON "branch_recipe"("branch_id", "active", "id");
CREATE UNIQUE INDEX "branch_recipe_organization_id_id_key" ON "branch_recipe"("organization_id", "id");
CREATE UNIQUE INDEX "branch_recipe_organization_id_branch_id_recipe_id_key"
  ON "branch_recipe"("organization_id", "branch_id", "recipe_id");

ALTER TABLE "branch_recipe" ADD CONSTRAINT "branch_recipe_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "branch_recipe" ADD CONSTRAINT "branch_recipe_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "branch_recipe" ADD CONSTRAINT "branch_recipe_organization_id_recipe_id_fkey"
  FOREIGN KEY ("organization_id", "recipe_id") REFERENCES "recipe"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Recipe scope: null branch is a company template, a set branch is a local or
-- customized definition. Existing recipes stay branch-local of the initial
-- branch, preserving ids, UUIDs, versions, lines and nested graph.
ALTER TABLE "recipe"
  ADD COLUMN "branch_id" INTEGER,
  ADD COLUMN "source_recipe_id" INTEGER,
  ADD COLUMN "source_version" INTEGER;

UPDATE "recipe" r
SET "branch_id" = b."id"
FROM "branch" b
WHERE b."organization_id" = r."organization_id";

CREATE INDEX "recipe_branch_id_id_idx" ON "recipe"("branch_id", "id");
CREATE INDEX "recipe_source_recipe_id_idx" ON "recipe"("source_recipe_id");
CREATE UNIQUE INDEX "recipe_branch_id_source_recipe_id_key"
  ON "recipe"("branch_id", "source_recipe_id");

ALTER TABLE "recipe" ADD CONSTRAINT "recipe_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_organization_id_source_recipe_id_fkey"
  FOREIGN KEY ("organization_id", "source_recipe_id") REFERENCES "recipe"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_branch_source_scope_check" CHECK (
  ("source_recipe_id" IS NULL AND "source_version" IS NULL)
  OR (
    "branch_id" IS NOT NULL
    AND "source_recipe_id" IS NOT NULL
    AND "source_version" IS NOT NULL
    AND "source_recipe_id" <> "id"
    AND "source_version" >= 0
  )
);

-- Every balance movement must name the branch whose balance changed.
ALTER TABLE "item_tracking" ADD COLUMN "branch_id" INTEGER;
UPDATE "item_tracking" t
SET "branch_id" = b."id"
FROM "branch" b
WHERE b."organization_id" = t."organization_id";
ALTER TABLE "item_tracking" ALTER COLUMN "branch_id" SET NOT NULL;
CREATE INDEX "item_tracking_organization_id_branch_id_item_id_date_idx"
  ON "item_tracking"("organization_id", "branch_id", "item_id", "date");
ALTER TABLE "item_tracking" ADD CONSTRAINT "item_tracking_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Purchase order origin (null = company, set = raising branch). Existing
-- orders keep their historical behavior by originating from the initial branch;
-- delivery destinations are recorded per receipt from now on.
ALTER TABLE "purchase_order" ADD COLUMN "branch_id" INTEGER;
UPDATE "purchase_order" po
SET "branch_id" = b."id"
FROM "branch" b
WHERE b."organization_id" = po."organization_id";
CREATE INDEX "purchase_order_organization_id_branch_id_status_idx"
  ON "purchase_order"("organization_id", "branch_id", "status");
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Immutable receipt events with branch destination and exact snapshots.
CREATE TABLE "purchase_receipt" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "order_id" INTEGER NOT NULL,
    "line_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "item_id" INTEGER,
    "item_uuid" UUID,
    "quantity" DECIMAL(15,5) NOT NULL,
    "stock_quantity" DECIMAL(20,5),
    "unit_code" VARCHAR(20),
    "pack_quantity_native" DECIMAL(20,10),
    "purchase_price" DECIMAL(19,6),
    "discount" DECIMAL(5,2),
    "currency_code" VARCHAR(3),
    "notes" VARCHAR(512),
    "user_id" TEXT,
    "occurred_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "request_key" VARCHAR(100),
    "legacy_baseline" BOOLEAN NOT NULL DEFAULT false,
    "reversal_of_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_receipt_uuid_key" ON "purchase_receipt"("uuid");
CREATE UNIQUE INDEX "purchase_receipt_reversal_of_id_key" ON "purchase_receipt"("reversal_of_id");
CREATE INDEX "purchase_receipt_organization_id_order_id_id_idx"
  ON "purchase_receipt"("organization_id", "order_id", "id");
CREATE INDEX "purchase_receipt_organization_id_order_id_branch_id_idx"
  ON "purchase_receipt"("organization_id", "order_id", "branch_id");
CREATE INDEX "purchase_receipt_line_id_idx" ON "purchase_receipt"("line_id");
CREATE INDEX "purchase_receipt_item_id_idx" ON "purchase_receipt"("item_id");
CREATE INDEX "purchase_receipt_user_id_idx" ON "purchase_receipt"("user_id");
CREATE UNIQUE INDEX "purchase_receipt_organization_id_request_key_line_id_key"
  ON "purchase_receipt"("organization_id", "request_key", "line_id");

ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_organization_id_order_id_fkey"
  FOREIGN KEY ("organization_id", "order_id") REFERENCES "purchase_order"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_organization_id_line_id_fkey"
  FOREIGN KEY ("organization_id", "line_id") REFERENCES "purchase_order_line_item"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "part"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_reversal_of_id_fkey"
  FOREIGN KEY ("reversal_of_id") REFERENCES "purchase_receipt"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A real event has stock, price, discount, actor time and a replay key; a
-- legacy baseline is aggregate-only and must not pretend otherwise.
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_legacy_check" CHECK (
  ("legacy_baseline" AND "stock_quantity" IS NULL AND "reversal_of_id" IS NULL)
  OR (
    NOT "legacy_baseline"
    AND "stock_quantity" IS NOT NULL
    AND "discount" IS NOT NULL
    AND "occurred_at" IS NOT NULL
    AND "request_key" IS NOT NULL
  )
);
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_direction_check" CHECK (
  (("reversal_of_id" IS NULL AND "quantity" > 0) OR ("reversal_of_id" IS NOT NULL AND "quantity" < 0))
  AND (
    "stock_quantity" IS NULL
    OR ("reversal_of_id" IS NULL AND "stock_quantity" > 0)
    OR ("reversal_of_id" IS NOT NULL AND "stock_quantity" < 0)
  )
);
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_discount_check" CHECK (
  "discount" IS NULL OR ("discount" >= 0 AND "discount" <= 100)
);

-- Honest legacy provenance: the only surviving fact is the aggregate received
-- order quantity. Per-event stock quantity, unit, pack, price, discount,
-- currency, actor, request key and time stay NULL; the line aggregate is never
-- rewritten.
INSERT INTO "purchase_receipt" (
  "organization_id", "order_id", "line_id", "branch_id", "item_id", "item_uuid",
  "quantity", "stock_quantity", "unit_code", "pack_quantity_native",
  "purchase_price", "discount", "currency_code", "notes", "user_id",
  "occurred_at", "request_key", "legacy_baseline", "reversal_of_id"
)
SELECT
  l."organization_id",
  l."order_id",
  l."id",
  o."branch_id",
  l."item_id",
  p."uuid",
  l."received",
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'Legacy aggregate received quantity migrated from the purchase line; per-event stock, price, actor and time are unknown.',
  NULL,
  NULL,
  NULL,
  true,
  NULL
FROM "purchase_order_line_item" l
JOIN "purchase_order" o
  ON o."organization_id" = l."organization_id" AND o."id" = l."order_id"
LEFT JOIN "part" p ON p."id" = l."item_id"
WHERE l."received" <> 0;

DO $$
DECLARE
  copied INTEGER;
  expected INTEGER;
BEGIN
  SELECT count(*) INTO copied FROM "purchase_receipt" WHERE "legacy_baseline";
  SELECT count(*) INTO expected FROM "purchase_order_line_item" WHERE "received" <> 0;
  IF copied <> expected THEN
    RAISE EXCEPTION 'legacy receipt baseline copy missed rows: copied %, expected %', copied, expected;
  END IF;
END $$;

-- Sales records the branch it consumed and, where known, which definition was
-- frozen. Existing sales used the requested recipe itself.
ALTER TABLE "build"
  ADD COLUMN "branch_id" INTEGER,
  ADD COLUMN "recipe_definition_uuid" UUID,
  ADD COLUMN "recipe_source_version" INTEGER;
UPDATE "build" b
SET "branch_id" = br."id",
    "recipe_definition_uuid" = b."requested_recipe_uuid"
FROM "branch" br
WHERE br."organization_id" = b."organization_id";
ALTER TABLE "build" ALTER COLUMN "branch_id" SET NOT NULL;
CREATE INDEX "build_organization_id_branch_id_id_idx"
  ON "build"("organization_id", "branch_id", "id");
ALTER TABLE "build" ADD CONSTRAINT "build_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "sales_batch" ADD COLUMN "branch_id" INTEGER;
UPDATE "sales_batch" sb
SET "branch_id" = b."id"
FROM "branch" b
WHERE b."organization_id" = sb."organization_id";
ALTER TABLE "sales_batch" ALTER COLUMN "branch_id" SET NOT NULL;
CREATE INDEX "sales_batch_organization_id_branch_id_id_idx"
  ON "sales_batch"("organization_id", "branch_id", "id");
ALTER TABLE "sales_batch" ADD CONSTRAINT "sales_batch_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

DROP INDEX IF EXISTS "sales_product_mapping_organization_id_product_key_key";
ALTER TABLE "sales_product_mapping" ADD COLUMN "branch_id" INTEGER;
UPDATE "sales_product_mapping" m
SET "branch_id" = b."id"
FROM "branch" b
WHERE b."organization_id" = m."organization_id";
ALTER TABLE "sales_product_mapping" ALTER COLUMN "branch_id" SET NOT NULL;
CREATE UNIQUE INDEX "sales_product_mapping_organization_id_branch_id_product_key_key"
  ON "sales_product_mapping"("organization_id", "branch_id", "product_key");
ALTER TABLE "sales_product_mapping" ADD CONSTRAINT "sales_product_mapping_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "pos_device" ADD COLUMN "branch_id" INTEGER;
UPDATE "pos_device" d
SET "branch_id" = b."id"
FROM "branch" b
WHERE b."organization_id" = d."organization_id";
ALTER TABLE "pos_device" ALTER COLUMN "branch_id" SET NOT NULL;
CREATE INDEX "pos_device_organization_id_branch_id_id_idx"
  ON "pos_device"("organization_id", "branch_id", "id");
ALTER TABLE "pos_device" ADD CONSTRAINT "pos_device_organization_id_branch_id_fkey"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branch"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Cross-row invariants that must hold in the database, not only in services.
CREATE FUNCTION "purchase_receipt_guard"() RETURNS TRIGGER AS $$
DECLARE origin "purchase_receipt"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'purchase receipts are immutable and cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only FK maintenance from item/user deletion may clear the live links;
    -- every frozen fact must stay byte-identical.
    IF (
        (NEW."item_id" IS NOT DISTINCT FROM OLD."item_id"
          OR (OLD."item_id" IS NOT NULL AND NEW."item_id" IS NULL))
        AND (NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"
          OR (OLD."user_id" IS NOT NULL AND NEW."user_id" IS NULL))
        AND NEW."organization_id" = OLD."organization_id"
        AND NEW."id" = OLD."id"
        AND NEW."uuid" = OLD."uuid"
        AND NEW."order_id" = OLD."order_id"
        AND NEW."line_id" = OLD."line_id"
        AND NEW."branch_id" = OLD."branch_id"
        AND NEW."item_uuid" IS NOT DISTINCT FROM OLD."item_uuid"
        AND NEW."quantity" = OLD."quantity"
        AND NEW."stock_quantity" IS NOT DISTINCT FROM OLD."stock_quantity"
        AND NEW."unit_code" IS NOT DISTINCT FROM OLD."unit_code"
        AND NEW."pack_quantity_native" IS NOT DISTINCT FROM OLD."pack_quantity_native"
        AND NEW."purchase_price" IS NOT DISTINCT FROM OLD."purchase_price"
        AND NEW."discount" IS NOT DISTINCT FROM OLD."discount"
        AND NEW."currency_code" IS NOT DISTINCT FROM OLD."currency_code"
        AND NEW."notes" IS NOT DISTINCT FROM OLD."notes"
        AND NEW."occurred_at" IS NOT DISTINCT FROM OLD."occurred_at"
        AND NEW."request_key" IS NOT DISTINCT FROM OLD."request_key"
        AND NEW."legacy_baseline" = OLD."legacy_baseline"
        AND NEW."reversal_of_id" IS NOT DISTINCT FROM OLD."reversal_of_id"
        AND NEW."created_at" = OLD."created_at"
      ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'purchase receipts are immutable';
  END IF;

  IF NEW."reversal_of_id" IS NOT NULL THEN
    SELECT * INTO origin FROM "purchase_receipt" WHERE "id" = NEW."reversal_of_id";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'receipt reversal target does not exist';
    END IF;
    IF origin."legacy_baseline" THEN
      RAISE EXCEPTION 'a legacy receipt baseline cannot be reversed';
    END IF;
    IF origin."reversal_of_id" IS NOT NULL THEN
      RAISE EXCEPTION 'a receipt reversal cannot itself be reversed';
    END IF;
    IF origin."organization_id" <> NEW."organization_id"
      OR origin."order_id" <> NEW."order_id"
      OR origin."line_id" <> NEW."line_id"
      OR origin."branch_id" <> NEW."branch_id" THEN
      RAISE EXCEPTION 'a receipt reversal must target the same order line and branch';
    END IF;
    IF NEW."quantity" <> -origin."quantity"
      OR NEW."stock_quantity" IS DISTINCT FROM -origin."stock_quantity" THEN
      RAISE EXCEPTION 'a receipt reversal must negate the original quantity';
    END IF;
    IF NEW."unit_code" IS DISTINCT FROM origin."unit_code"
      OR NEW."pack_quantity_native" IS DISTINCT FROM origin."pack_quantity_native"
      OR NEW."purchase_price" IS DISTINCT FROM origin."purchase_price"
      OR NEW."discount" IS DISTINCT FROM origin."discount"
      OR NEW."currency_code" IS DISTINCT FROM origin."currency_code"
      OR NEW."item_id" IS DISTINCT FROM origin."item_id"
      OR NEW."item_uuid" IS DISTINCT FROM origin."item_uuid"
      OR NEW."legacy_baseline" THEN
      RAISE EXCEPTION 'a receipt reversal must repeat the original snapshots';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "purchase_order_line_item" l
    WHERE l."organization_id" = NEW."organization_id"
      AND l."id" = NEW."line_id"
      AND l."order_id" = NEW."order_id"
  ) THEN
    RAISE EXCEPTION 'a receipt line must belong to its purchase order';
  END IF;
  IF NEW."item_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "part" p
    WHERE p."id" = NEW."item_id" AND p."organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'a receipt item must belong to the same company';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "purchase_receipt_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "purchase_receipt"
  FOR EACH ROW EXECUTE FUNCTION "purchase_receipt_guard"();

CREATE FUNCTION "purchase_order_origin_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."branch_id" IS DISTINCT FROM OLD."branch_id"
    AND (
      OLD."status" <> 10
      OR EXISTS (
        SELECT 1 FROM "purchase_receipt" r
        WHERE r."organization_id" = OLD."organization_id" AND r."order_id" = OLD."id"
      )
    ) THEN
    RAISE EXCEPTION 'purchase order origin is immutable once operational or received';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "purchase_order_origin_guard"
  BEFORE UPDATE ON "purchase_order"
  FOR EACH ROW EXECUTE FUNCTION "purchase_order_origin_guard"();

CREATE FUNCTION "build_branch_guard"() RETURNS TRIGGER AS $$
DECLARE batch_branch INTEGER;
BEGIN
  IF NEW."batch_id" IS NOT NULL THEN
    SELECT "branch_id" INTO batch_branch
    FROM "sales_batch"
    WHERE "organization_id" = NEW."organization_id" AND "id" = NEW."batch_id";
    IF batch_branch IS DISTINCT FROM NEW."branch_id" THEN
      RAISE EXCEPTION 'a sale must consume the same branch as its sales batch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "build_branch_guard"
  BEFORE INSERT OR UPDATE ON "build"
  FOR EACH ROW EXECUTE FUNCTION "build_branch_guard"();

CREATE FUNCTION "sales_product_mapping_branch_guard"() RETURNS TRIGGER AS $$
DECLARE recipe_branch INTEGER;
BEGIN
  SELECT "branch_id" INTO recipe_branch
  FROM "recipe"
  WHERE "organization_id" = NEW."organization_id" AND "id" = NEW."recipe_id";
  IF recipe_branch IS NOT NULL AND recipe_branch <> NEW."branch_id" THEN
    RAISE EXCEPTION 'a product mapping may only reference a company recipe or one of its branch recipes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "sales_product_mapping_branch_guard"
  BEFORE INSERT OR UPDATE ON "sales_product_mapping"
  FOR EACH ROW EXECUTE FUNCTION "sales_product_mapping_branch_guard"();

CREATE FUNCTION "pos_device_branch_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."branch_id" IS DISTINCT FROM OLD."branch_id"
    AND EXISTS (
      SELECT 1 FROM "pos_device_z_report" z
      WHERE z."organization_id" = OLD."organization_id" AND z."pos_device_id" = OLD."id"
    ) THEN
    RAISE EXCEPTION 'a POS device branch is immutable once reports exist';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "pos_device_branch_guard"
  BEFORE UPDATE ON "pos_device"
  FOR EACH ROW EXECUTE FUNCTION "pos_device_branch_guard"();

CREATE FUNCTION "pos_device_z_report_branch_guard"() RETURNS TRIGGER AS $$
DECLARE
  device_branch INTEGER;
  batch_branch INTEGER;
BEGIN
  SELECT "branch_id" INTO device_branch
  FROM "pos_device"
  WHERE "organization_id" = NEW."organization_id" AND "id" = NEW."pos_device_id";
  IF NEW."sales_batch_id" IS NOT NULL THEN
    SELECT "branch_id" INTO batch_branch
    FROM "sales_batch"
    WHERE "organization_id" = NEW."organization_id" AND "id" = NEW."sales_batch_id";
    IF batch_branch IS DISTINCT FROM device_branch THEN
      RAISE EXCEPTION 'a Z report batch must belong to the device branch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "pos_device_z_report_branch_guard"
  BEFORE INSERT OR UPDATE ON "pos_device_z_report"
  FOR EACH ROW EXECUTE FUNCTION "pos_device_z_report_branch_guard"();

CREATE FUNCTION "recipe_scope_guard"() RETURNS TRIGGER AS $$
DECLARE source_row "recipe"%ROWTYPE;
BEGIN
  IF NEW."source_recipe_id" IS NOT NULL THEN
    SELECT * INTO source_row
    FROM "recipe"
    WHERE "organization_id" = NEW."organization_id" AND "id" = NEW."source_recipe_id";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'recipe source does not exist';
    END IF;
    IF source_row."branch_id" IS NOT NULL THEN
      RAISE EXCEPTION 'a recipe customization may only pin a company recipe';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."branch_id" IS DISTINCT FROM OLD."branch_id"
      OR NEW."source_recipe_id" IS DISTINCT FROM OLD."source_recipe_id"
      OR NEW."source_version" IS DISTINCT FROM OLD."source_version" THEN
      RAISE EXCEPTION 'recipe scope and source pin are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recipe_scope_guard"
  BEFORE INSERT OR UPDATE ON "recipe"
  FOR EACH ROW EXECUTE FUNCTION "recipe_scope_guard"();

CREATE FUNCTION "branch_recipe_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "recipe" r
    WHERE r."organization_id" = NEW."organization_id"
      AND r."id" = NEW."recipe_id"
      AND r."branch_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'branch activation requires a company recipe';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "branch_recipe_guard"
  BEFORE INSERT OR UPDATE ON "branch_recipe"
  FOR EACH ROW EXECUTE FUNCTION "branch_recipe_guard"();

-- Existing Z-report attachments were single-location, so they agree with the
-- initial branch attribution; fail loudly if the live data says otherwise.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "pos_device_z_report" z
    JOIN "pos_device" d
      ON d."organization_id" = z."organization_id" AND d."id" = z."pos_device_id"
    JOIN "sales_batch" sb
      ON sb."organization_id" = z."organization_id" AND sb."id" = z."sales_batch_id"
    WHERE z."sales_batch_id" IS NOT NULL AND d."branch_id" <> sb."branch_id"
  ) THEN
    RAISE EXCEPTION 'existing Z reports link a device and batch from different branches';
  END IF;
END $$;

-- Only now is the aggregate balance transferred: branch_stock holds the exact
-- values and item_tracking has its branch attribution. The old single-column
-- checks `part_stock_check` and `part_minimum_stock_check` depend on these
-- columns only, so PostgreSQL drops them with the columns; any view or
-- user-defined trigger depending on them aborted the preflight above instead.
ALTER TABLE "part"
  DROP COLUMN "minimum_stock",
  DROP COLUMN "stock";

COMMIT;
