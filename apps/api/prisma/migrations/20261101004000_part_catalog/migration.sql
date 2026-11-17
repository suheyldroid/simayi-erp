CREATE TABLE "part_category" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(250) NOT NULL DEFAULT '',
  "parent_id" INTEGER,
  "pathstring" VARCHAR(250) NOT NULL DEFAULT '',
  "metadata" JSONB,
  "default_location_id" INTEGER,
  "structural" BOOLEAN NOT NULL DEFAULT false,
  "default_keywords" VARCHAR(250),
  "icon" VARCHAR(100),
  CONSTRAINT "part_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "part_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "part_category_default_location_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_category_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "part_category_name_nonempty_check" CHECK (length(trim("name")) > 0)
);
CREATE INDEX "part_category_default_location_id_idx" ON "part_category"("default_location_id");
CREATE INDEX "part_category_parent_id_idx" ON "part_category"("parent_id");

CREATE TABLE "parameter_template" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "model_type_id" INTEGER,
  "name" VARCHAR(100) NOT NULL,
  "units" VARCHAR(25) NOT NULL DEFAULT '',
  "description" VARCHAR(250) NOT NULL DEFAULT '',
  "checkbox" BOOLEAN NOT NULL DEFAULT false,
  "choices" VARCHAR(5000) NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "unique" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "parameter_template_name_key" UNIQUE ("name"),
  CONSTRAINT "parameter_template_model_type_id_fkey" FOREIGN KEY ("model_type_id") REFERENCES "model_type"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "parameter_template_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "parameter_template_name_nonempty_check" CHECK (length(trim("name")) > 0),
  CONSTRAINT "parameter_template_unique_check" CHECK ("unique" IN (0, 1, 2))
);
CREATE INDEX "parameter_template_model_type_id_idx" ON "parameter_template"("model_type_id");

CREATE TABLE "part_category_parameter_template" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "category_id" INTEGER NOT NULL,
  "template_id" INTEGER NOT NULL,
  "default_value" VARCHAR(500) NOT NULL DEFAULT '',
  CONSTRAINT "part_category_parameter_template_category_id_template_id_key" UNIQUE ("category_id", "template_id"),
  CONSTRAINT "part_category_parameter_template_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "part_category"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "part_category_parameter_template_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "parameter_template"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "part_category_parameter_template_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);
CREATE INDEX "part_category_parameter_template_template_id_idx" ON "part_category_parameter_template"("template_id");

CREATE TABLE "part" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "image" VARCHAR(100),
  "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
  "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
  "name" VARCHAR(100) NOT NULL,
  "is_template" BOOLEAN NOT NULL,
  "variant_of_id" INTEGER,
  "description" VARCHAR(250) NOT NULL DEFAULT '',
  "keywords" VARCHAR(250),
  "category_id" INTEGER,
  "ipn" VARCHAR(100),
  "revision" VARCHAR(100),
  "revision_of_id" INTEGER,
  "link" VARCHAR(2000),
  "default_location_id" INTEGER,
  "default_expiry" INTEGER NOT NULL DEFAULT 0,
  "minimum_stock" NUMERIC(19, 6) NOT NULL DEFAULT 0,
  "maximum_stock" NUMERIC(19, 6) NOT NULL DEFAULT 0,
  "units" VARCHAR(20) DEFAULT '',
  "assembly" BOOLEAN NOT NULL,
  "component" BOOLEAN NOT NULL,
  "trackable" BOOLEAN NOT NULL,
  "testable" BOOLEAN NOT NULL DEFAULT false,
  "purchaseable" BOOLEAN NOT NULL,
  "salable" BOOLEAN NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "virtual" BOOLEAN NOT NULL,
  "consumable" BOOLEAN NOT NULL DEFAULT false,
  "bom_validated" BOOLEAN NOT NULL DEFAULT false,
  "bom_checksum" VARCHAR(128) NOT NULL DEFAULT '',
  "bom_checked_by_id" TEXT,
  "bom_checked_date" DATE,
  "creation_date" DATE DEFAULT CURRENT_DATE,
  "creation_user_id" TEXT,
  "responsible_owner_id" INTEGER,
  "base_cost" NUMERIC(19, 6) NOT NULL DEFAULT 0,
  "multiple" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "part_name_ipn_revision_key" UNIQUE ("name", "ipn", "revision"),
  CONSTRAINT "part_variant_of_id_fkey" FOREIGN KEY ("variant_of_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "part_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "part_revision_of_id_fkey" FOREIGN KEY ("revision_of_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_default_location_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_bom_checked_by_id_fkey" FOREIGN KEY ("bom_checked_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_creation_user_id_fkey" FOREIGN KEY ("creation_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_responsible_owner_id_fkey" FOREIGN KEY ("responsible_owner_id") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "part_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "part_name_nonempty_check" CHECK (length(trim("name")) > 0),
  CONSTRAINT "part_default_expiry_check" CHECK ("default_expiry" >= 0),
  CONSTRAINT "part_minimum_stock_check" CHECK ("minimum_stock" >= 0),
  CONSTRAINT "part_maximum_stock_check" CHECK ("maximum_stock" >= 0),
  CONSTRAINT "part_base_cost_check" CHECK ("base_cost" >= 0),
  CONSTRAINT "part_multiple_check" CHECK ("multiple" >= 1),
  CONSTRAINT "part_version_check" CHECK ("version" >= 0)
);
CREATE INDEX "part_category_id_active_id_idx" ON "part"("category_id", "active", "id");
CREATE INDEX "part_variant_of_id_id_idx" ON "part"("variant_of_id", "id");
CREATE INDEX "part_revision_of_id_id_idx" ON "part"("revision_of_id", "id");
CREATE INDEX "part_bom_checked_by_id_idx" ON "part"("bom_checked_by_id");
CREATE INDEX "part_responsible_owner_id_idx" ON "part"("responsible_owner_id");
CREATE INDEX "part_default_location_id_idx" ON "part"("default_location_id");
CREATE INDEX "part_ipn_idx" ON "part"("ipn");
CREATE INDEX "part_creation_user_id_idx" ON "part"("creation_user_id");

CREATE TABLE "parameter" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "updated" TIMESTAMPTZ(6),
  "updated_by_id" TEXT,
  "model_type_id" INTEGER NOT NULL,
  "model_id" INTEGER NOT NULL,
  "template_id" INTEGER NOT NULL,
  "data" VARCHAR(500) NOT NULL,
  "data_numeric" DOUBLE PRECISION,
  "note" VARCHAR(500) NOT NULL DEFAULT '',
  CONSTRAINT "parameter_model_type_id_model_id_template_id_key" UNIQUE ("model_type_id", "model_id", "template_id"),
  CONSTRAINT "parameter_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "parameter_model_type_id_fkey" FOREIGN KEY ("model_type_id") REFERENCES "model_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "parameter_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "parameter_template"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "parameter_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "parameter_model_id_check" CHECK ("model_id" >= 0)
);
CREATE INDEX "parameter_template_id_idx" ON "parameter"("template_id");
CREATE INDEX "parameter_updated_by_id_idx" ON "parameter"("updated_by_id");

INSERT INTO "model_type" ("app_label", "model") VALUES
  ('common', 'parametertemplate'),
  ('common', 'parameter'),
  ('part', 'partcategoryparametertemplate')
ON CONFLICT ("app_label", "model") DO NOTHING;
