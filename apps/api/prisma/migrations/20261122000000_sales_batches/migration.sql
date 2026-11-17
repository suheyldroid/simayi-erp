-- Sales channels and uploaded workbook batches.
-- Forward migration for the state produced by 20261121000000_system_units_currency.
-- It does not record that it was applied and it has not been executed against
-- any database by this change. Prisma does not wrap a PostgreSQL migration in a
-- transaction, so this file is one explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * Only additive changes are made. `build` gains nullable batch, channel,
--     business-date and source-traceability columns; existing manual sales keep
--     NULL there because their historical channel and business date are unknown.
--   * No rows are backfilled, rewritten or deleted.
--   * `sales_batch_source_file` is a server-generated stored name, not a client
--     path. The source workbook itself stays in the private media directory.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that reads the new tables and columns.

BEGIN;

LOCK TABLE "build" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "sales_channel" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "sales_channel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_channel_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "sales_channel_uuid_key" ON "sales_channel"("uuid");
CREATE UNIQUE INDEX "sales_channel_organization_id_name_key"
  ON "sales_channel"("organization_id", "name");
CREATE UNIQUE INDEX "sales_channel_organization_id_id_key"
  ON "sales_channel"("organization_id", "id");
CREATE INDEX "sales_channel_organization_id_active_id_idx"
  ON "sales_channel"("organization_id", "active", "id");

CREATE TABLE "sales_channel_mapping" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "source_value" VARCHAR(200) NOT NULL,
  "channel_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "sales_channel_mapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_channel_mapping_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "sales_channel_mapping_organization_id_channel_id_fkey"
    FOREIGN KEY ("organization_id", "channel_id")
    REFERENCES "sales_channel"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "sales_channel_mapping_uuid_key"
  ON "sales_channel_mapping"("uuid");
CREATE UNIQUE INDEX "sales_channel_mapping_organization_id_source_value_key"
  ON "sales_channel_mapping"("organization_id", "source_value");
CREATE UNIQUE INDEX "sales_channel_mapping_organization_id_id_key"
  ON "sales_channel_mapping"("organization_id", "id");
CREATE INDEX "sales_channel_mapping_channel_id_idx"
  ON "sales_channel_mapping"("channel_id");

CREATE TABLE "sales_batch" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "reference" VARCHAR(64) NOT NULL,
  "reference_int" BIGINT NOT NULL DEFAULT 0,
  "business_date" DATE NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 10,
  "source_file_name" VARCHAR(255) NOT NULL,
  "source_file" VARCHAR(100) NOT NULL,
  "source_file_size" INTEGER NOT NULL,
  "sheet_names" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sheet_name" VARCHAR(200),
  "header_row" INTEGER,
  "channel_column" VARCHAR(3),
  "product_column" VARCHAR(3),
  "quantity_column" VARCHAR(3),
  "product_code_column" VARCHAR(3),
  "excluded_rows" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "quantity_total" INTEGER NOT NULL DEFAULT 0,
  "channel_count" INTEGER NOT NULL DEFAULT 0,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,
  "created_by_name" TEXT NOT NULL,

  CONSTRAINT "sales_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_batch_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "sales_batch_created_by_id_fkey" FOREIGN KEY ("created_by_id")
    REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "sales_batch_uuid_key" ON "sales_batch"("uuid");
CREATE UNIQUE INDEX "sales_batch_organization_id_reference_key"
  ON "sales_batch"("organization_id", "reference");
CREATE UNIQUE INDEX "sales_batch_organization_id_id_key"
  ON "sales_batch"("organization_id", "id");
CREATE INDEX "sales_batch_organization_id_id_idx"
  ON "sales_batch"("organization_id", "id");
CREATE INDEX "sales_batch_created_by_id_idx" ON "sales_batch"("created_by_id");

CREATE TABLE "sales_batch_channel" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "batch_id" INTEGER NOT NULL,
  "source_value" VARCHAR(200) NOT NULL,
  "channel_id" INTEGER,

  CONSTRAINT "sales_batch_channel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_batch_channel_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "sales_batch_channel_organization_id_batch_id_fkey"
    FOREIGN KEY ("organization_id", "batch_id")
    REFERENCES "sales_batch"("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "sales_batch_channel_organization_id_channel_id_fkey"
    FOREIGN KEY ("organization_id", "channel_id")
    REFERENCES "sales_channel"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "sales_batch_channel_uuid_key"
  ON "sales_batch_channel"("uuid");
CREATE UNIQUE INDEX "sales_batch_channel_organization_id_batch_id_source_value_key"
  ON "sales_batch_channel"("organization_id", "batch_id", "source_value");
CREATE UNIQUE INDEX "sales_batch_channel_organization_id_id_key"
  ON "sales_batch_channel"("organization_id", "id");
CREATE INDEX "sales_batch_channel_batch_id_idx"
  ON "sales_batch_channel"("batch_id");
CREATE INDEX "sales_batch_channel_channel_id_idx"
  ON "sales_batch_channel"("channel_id");

CREATE TABLE "sales_product_mapping" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "product_key" VARCHAR(250) NOT NULL,
  "product_label" VARCHAR(200) NOT NULL,
  "source_code" VARCHAR(100),
  "source_text" VARCHAR(200),
  "recipe_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "sales_product_mapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_product_mapping_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "sales_product_mapping_recipe_id_fkey" FOREIGN KEY ("recipe_id")
    REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "sales_product_mapping_uuid_key"
  ON "sales_product_mapping"("uuid");
CREATE UNIQUE INDEX "sales_product_mapping_organization_id_product_key_key"
  ON "sales_product_mapping"("organization_id", "product_key");
CREATE UNIQUE INDEX "sales_product_mapping_organization_id_id_key"
  ON "sales_product_mapping"("organization_id", "id");
CREATE INDEX "sales_product_mapping_recipe_id_idx"
  ON "sales_product_mapping"("recipe_id");

ALTER TABLE "build"
  ADD COLUMN "batch_id" INTEGER,
  ADD COLUMN "channel_id" INTEGER,
  ADD COLUMN "business_date" DATE,
  ADD COLUMN "source_sheet" VARCHAR(200),
  ADD COLUMN "source_row" INTEGER,
  ADD COLUMN "source_channel_text" VARCHAR(200),
  ADD COLUMN "source_product_text" VARCHAR(200);

ALTER TABLE "build"
  ADD CONSTRAINT "build_organization_id_batch_id_fkey"
    FOREIGN KEY ("organization_id", "batch_id")
    REFERENCES "sales_batch"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "build_organization_id_channel_id_fkey"
    FOREIGN KEY ("organization_id", "channel_id")
    REFERENCES "sales_channel"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "build_batch_id_idx" ON "build"("batch_id");
CREATE INDEX "build_channel_id_idx" ON "build"("channel_id");
CREATE INDEX "build_organization_id_business_date_idx"
  ON "build"("organization_id", "business_date");

COMMIT;
