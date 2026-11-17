-- Organization finance, supplier ledger and recorded price snapshots.
-- Forward migration for the state produced by 20261122000000_sales_batches.
-- It does not record that it was applied and it has not been executed against
-- any database by this change. Prisma does not wrap a PostgreSQL migration in a
-- transaction, so this file is one explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * Only additive changes are made.
--   * `recipe` gains nullable `selling_price` and `price_currency_code`; every
--     existing recipe stays unpriced (NULL), which is distinct from a zero
--     price.
--   * `build` gains nullable `unit_price`, `total_price` and `currency_code`;
--     every existing sale keeps NULL there because its monetary value is
--     historically unknown and is never backfilled.
--   * No rows are backfilled, rewritten or deleted.
--   * Amounts are exact `DECIMAL(19,6)` values. Money and supplier rows are
--     append-only: immutable originals plus at most one linked reversal row.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that reads the new tables and columns.

BEGIN;

LOCK TABLE "recipe", "build", "supplier", "purchase_order"
  IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "recipe"
  ADD COLUMN "selling_price" DECIMAL(19,6),
  ADD COLUMN "price_currency_code" VARCHAR(3);

ALTER TABLE "build"
  ADD COLUMN "unit_price" DECIMAL(19,6),
  ADD COLUMN "total_price" DECIMAL(19,6),
  ADD COLUMN "currency_code" VARCHAR(3);

ALTER TABLE "recipe"
  ADD CONSTRAINT "recipe_selling_price_check"
    CHECK ("selling_price" IS NULL OR "selling_price" >= 0),
  ADD CONSTRAINT "recipe_price_currency_check"
    CHECK (
      ("selling_price" IS NULL AND "price_currency_code" IS NULL)
      OR (
        "selling_price" IS NOT NULL
        AND "price_currency_code" IS NOT NULL
        AND "price_currency_code" ~ '^[A-Z]{3}$'
      )
    );

ALTER TABLE "build"
  ADD CONSTRAINT "build_unit_price_check"
    CHECK ("unit_price" IS NULL OR "unit_price" >= 0),
  ADD CONSTRAINT "build_total_price_check"
    CHECK ("total_price" IS NULL OR "total_price" >= 0),
  ADD CONSTRAINT "build_price_snapshot_check"
    CHECK (
      (
        "unit_price" IS NULL
        AND "total_price" IS NULL
        AND "currency_code" IS NULL
      )
      OR (
        "unit_price" IS NOT NULL
        AND "total_price" IS NOT NULL
        AND "currency_code" IS NOT NULL
        AND "currency_code" ~ '^[A-Z]{3}$'
      )
    );

CREATE TABLE "organization_finance" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_finance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_finance_currency_code_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "organization_finance_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "organization_finance_uuid_key"
  ON "organization_finance"("uuid");
CREATE UNIQUE INDEX "organization_finance_organization_id_key"
  ON "organization_finance"("organization_id");

CREATE TABLE "money_movement" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "entry_kind" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "amount" DECIMAL(19,6) NOT NULL,
  "occurred_at" DATE NOT NULL,
  "note" VARCHAR(500) NOT NULL DEFAULT '',
  "request_key" VARCHAR(100),
  "reversal_of_id" INTEGER,
  "build_id" INTEGER,
  "supplier_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,

  CONSTRAINT "money_movement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "money_movement_entry_kind_check"
    CHECK ("entry_kind" IN (10, 20, 30, 40, 50, 90)),
  CONSTRAINT "money_movement_amount_check" CHECK ("amount" <> 0),
  CONSTRAINT "money_movement_currency_code_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "money_movement_reversal_check"
    CHECK (("entry_kind" = 90) = ("reversal_of_id" IS NOT NULL)),
  CONSTRAINT "money_movement_reversal_self_check"
    CHECK ("reversal_of_id" IS NULL OR "reversal_of_id" <> "id"),
  CONSTRAINT "money_movement_source_check"
    CHECK (
      ("entry_kind" <> 40 OR "supplier_id" IS NOT NULL)
      AND ("entry_kind" <> 50 OR "build_id" IS NOT NULL)
    ),
  CONSTRAINT "money_movement_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "money_movement_build_id_fkey"
    FOREIGN KEY ("build_id") REFERENCES "build"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "money_movement_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "money_movement_reversal_of_id_fkey"
    FOREIGN KEY ("reversal_of_id") REFERENCES "money_movement"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "money_movement_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "money_movement_uuid_key" ON "money_movement"("uuid");
CREATE UNIQUE INDEX "money_movement_organization_id_id_key"
  ON "money_movement"("organization_id", "id");
CREATE UNIQUE INDEX "money_movement_reversal_of_id_key"
  ON "money_movement"("reversal_of_id");
CREATE UNIQUE INDEX "money_movement_opening_key"
  ON "money_movement"("organization_id") WHERE "entry_kind" = 10;
CREATE UNIQUE INDEX "money_movement_request_key_key"
  ON "money_movement"("organization_id", "request_key")
  WHERE "request_key" IS NOT NULL;
CREATE INDEX "money_movement_organization_id_occurred_at_id_idx"
  ON "money_movement"("organization_id", "occurred_at", "id");
CREATE INDEX "money_movement_build_id_idx" ON "money_movement"("build_id");
CREATE INDEX "money_movement_supplier_id_idx"
  ON "money_movement"("supplier_id");

CREATE TABLE "supplier_ledger_entry" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "entry_kind" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "amount" DECIMAL(19,6) NOT NULL,
  "occurred_at" DATE NOT NULL,
  "note" VARCHAR(500) NOT NULL DEFAULT '',
  "request_key" VARCHAR(100),
  "reversal_of_id" INTEGER,
  "purchase_order_id" INTEGER,
  "money_movement_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,

  CONSTRAINT "supplier_ledger_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_ledger_entry_entry_kind_check"
    CHECK ("entry_kind" IN (10, 20, 30, 90)),
  CONSTRAINT "supplier_ledger_entry_amount_check" CHECK ("amount" <> 0),
  CONSTRAINT "supplier_ledger_entry_currency_code_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "supplier_ledger_entry_reversal_check"
    CHECK (("entry_kind" = 90) = ("reversal_of_id" IS NOT NULL)),
  CONSTRAINT "supplier_ledger_entry_reversal_self_check"
    CHECK ("reversal_of_id" IS NULL OR "reversal_of_id" <> "id"),
  CONSTRAINT "supplier_ledger_entry_source_check"
    CHECK (
      ("entry_kind" <> 20 OR "purchase_order_id" IS NOT NULL)
      AND ("entry_kind" <> 30 OR "money_movement_id" IS NOT NULL)
    ),
  CONSTRAINT "supplier_ledger_entry_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "supplier_ledger_entry_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "supplier_ledger_entry_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "supplier_ledger_entry_money_movement_id_fkey"
    FOREIGN KEY ("money_movement_id") REFERENCES "money_movement"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "supplier_ledger_entry_reversal_of_id_fkey"
    FOREIGN KEY ("reversal_of_id") REFERENCES "supplier_ledger_entry"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "supplier_ledger_entry_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "supplier_ledger_entry_uuid_key"
  ON "supplier_ledger_entry"("uuid");
CREATE UNIQUE INDEX "supplier_ledger_entry_organization_id_id_key"
  ON "supplier_ledger_entry"("organization_id", "id");
CREATE UNIQUE INDEX "supplier_ledger_entry_reversal_of_id_key"
  ON "supplier_ledger_entry"("reversal_of_id");
CREATE UNIQUE INDEX "supplier_ledger_entry_money_movement_id_key"
  ON "supplier_ledger_entry"("money_movement_id");
CREATE UNIQUE INDEX "supplier_ledger_entry_opening_key"
  ON "supplier_ledger_entry"("organization_id", "supplier_id")
  WHERE "entry_kind" = 10;
CREATE UNIQUE INDEX "supplier_ledger_entry_purchase_order_key"
  ON "supplier_ledger_entry"("organization_id", "purchase_order_id")
  WHERE "entry_kind" = 20;
CREATE UNIQUE INDEX "supplier_ledger_entry_request_key_key"
  ON "supplier_ledger_entry"("organization_id", "request_key")
  WHERE "request_key" IS NOT NULL;
CREATE INDEX "supplier_ledger_entry_organization_supplier_idx"
  ON "supplier_ledger_entry"("organization_id", "supplier_id", "occurred_at", "id");
CREATE INDEX "supplier_ledger_entry_purchase_order_id_idx"
  ON "supplier_ledger_entry"("purchase_order_id");

COMMIT;
