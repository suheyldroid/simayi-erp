CREATE TABLE "manufacturer_part" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
  "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
  "part_id" INTEGER NOT NULL,
  "manufacturer_id" INTEGER,
  "mpn" VARCHAR(100),
  "link" VARCHAR(2000),
  "description" VARCHAR(250),
  CONSTRAINT "manufacturer_part_part_id_manufacturer_id_mpn_key" UNIQUE ("part_id", "manufacturer_id", "mpn"),
  CONSTRAINT "manufacturer_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "manufacturer_part_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "manufacturer_part_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);
CREATE INDEX "manufacturer_part_manufacturer_id_idx" ON "manufacturer_part"("manufacturer_id");

CREATE TABLE "supplier_part" (
  "id" SERIAL PRIMARY KEY,
  "updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
  "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
  "metadata" JSONB,
  "part_id" INTEGER NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "manufacturer_part_id" INTEGER,
  "link" VARCHAR(2000),
  "description" VARCHAR(250),
  "note" VARCHAR(100),
  "base_cost" NUMERIC(10, 3) NOT NULL DEFAULT 0,
  "packaging" VARCHAR(50),
  "pack_quantity" VARCHAR(25) NOT NULL DEFAULT '',
  "pack_quantity_native" NUMERIC(20, 10) DEFAULT 1,
  "multiple" INTEGER NOT NULL DEFAULT 1,
  "available" NUMERIC(10, 3) NOT NULL DEFAULT 0,
  "availability_updated" TIMESTAMPTZ(6),
  CONSTRAINT "supplier_part_part_id_supplier_id_sku_key" UNIQUE ("part_id", "supplier_id", "sku"),
  CONSTRAINT "supplier_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "supplier_part_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "supplier_part_manufacturer_part_id_fkey" FOREIGN KEY ("manufacturer_part_id") REFERENCES "manufacturer_part"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "supplier_part_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "supplier_part_base_cost_check" CHECK ("base_cost" >= 0),
  CONSTRAINT "supplier_part_multiple_check" CHECK ("multiple" >= 1),
  CONSTRAINT "supplier_part_available_check" CHECK ("available" >= 0),
  CONSTRAINT "supplier_part_sku_nonempty_check" CHECK (length(trim("sku")) > 0)
);
CREATE INDEX "supplier_part_manufacturer_part_id_idx" ON "supplier_part"("manufacturer_part_id");
CREATE INDEX "supplier_part_supplier_id_idx" ON "supplier_part"("supplier_id");

CREATE TABLE "supplier_price_break" (
  "id" SERIAL PRIMARY KEY,
  "updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "quantity" NUMERIC(15, 5) NOT NULL DEFAULT 1,
  "price" NUMERIC(19, 6),
  "part_id" INTEGER NOT NULL,
  "price_currency" VARCHAR(3),
  CONSTRAINT "supplier_price_break_part_id_quantity_key" UNIQUE ("part_id", "quantity"),
  CONSTRAINT "supplier_price_break_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "supplier_part"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "supplier_price_break_quantity_check" CHECK ("quantity" >= 1),
  CONSTRAINT "supplier_price_break_price_check" CHECK ("price" IS NULL OR "price" >= 0),
  CONSTRAINT "supplier_price_break_currency_check" CHECK ("price_currency" IS NULL OR "price_currency" ~ '^[A-Z]{3}$')
);

INSERT INTO "model_type" ("app_label", "model") VALUES
  ('company', 'manufacturerpart'),
  ('company', 'supplierpart'),
  ('company', 'supplierpricebreak')
ON CONFLICT ("app_label", "model") DO NOTHING;
