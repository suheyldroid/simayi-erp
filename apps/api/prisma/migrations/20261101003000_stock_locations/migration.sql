CREATE TABLE "stock_location_type" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(250) NOT NULL DEFAULT '',
  "icon" VARCHAR(100) NOT NULL DEFAULT '',
  CONSTRAINT "stock_location_type_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "stock_location_type_name_nonempty_check" CHECK (length(trim("name")) > 0)
);

CREATE TABLE "stock_location" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(250) NOT NULL DEFAULT '',
  "parent_id" INTEGER,
  "pathstring" VARCHAR(250) NOT NULL DEFAULT '',
  "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
  "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
  "custom_icon" VARCHAR(100),
  "owner_id" INTEGER,
  "structural" BOOLEAN NOT NULL DEFAULT false,
  "external" BOOLEAN NOT NULL DEFAULT false,
  "location_type_id" INTEGER,
  CONSTRAINT "stock_location_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stock_location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "stock_location_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "stock_location_location_type_id_fkey" FOREIGN KEY ("location_type_id") REFERENCES "stock_location_type"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "stock_location_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "stock_location_name_nonempty_check" CHECK (length(trim("name")) > 0)
);
CREATE INDEX "stock_location_location_type_id_idx" ON "stock_location"("location_type_id");
CREATE INDEX "stock_location_parent_id_idx" ON "stock_location"("parent_id");
CREATE INDEX "stock_location_owner_id_idx" ON "stock_location"("owner_id");

INSERT INTO "model_type" ("app_label", "model") VALUES
  ('stock', 'stocklocationtype')
ON CONFLICT ("app_label", "model") DO NOTHING;
