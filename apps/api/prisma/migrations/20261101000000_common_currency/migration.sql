CREATE TABLE "system_setting" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(50) NOT NULL,
  "value" VARCHAR(2000) NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX "system_setting_key_key" ON "system_setting"("key");

CREATE TABLE "user_setting" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(50) NOT NULL,
  "value" VARCHAR(2000) NOT NULL DEFAULT '',
  "user_id" TEXT,
  CONSTRAINT "user_setting_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_setting_key_user_id_key" ON "user_setting"("key", "user_id");
CREATE INDEX "user_setting_user_id_idx" ON "user_setting"("user_id");

CREATE TABLE "model_type" (
  "id" SERIAL PRIMARY KEY,
  "app_label" VARCHAR(100) NOT NULL,
  "model" VARCHAR(100) NOT NULL
);
CREATE UNIQUE INDEX "model_type_app_label_model_key" ON "model_type"("app_label", "model");

-- Registered integer business targets; clients cannot create arbitrary generic target types.
INSERT INTO "model_type" ("app_label", "model") VALUES
  ('common', 'projectcode'), ('common', 'customunit'),
  ('part', 'part'), ('part', 'partcategory'), ('part', 'bomitem'),
  ('stock', 'stockitem'), ('stock', 'stocklocation'), ('build', 'build'),
  ('order', 'purchaseorder'), ('order', 'salesorder'), ('order', 'returnorder'),
  ('order', 'returnorderlineitem'), ('order', 'transferorder');

CREATE TABLE "custom_unit" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(50) NOT NULL,
  "symbol" VARCHAR(10) NOT NULL DEFAULT '',
  "definition" VARCHAR(50) NOT NULL
);
CREATE UNIQUE INDEX "custom_unit_name_key" ON "custom_unit"("name");

CREATE TABLE "custom_status" (
  "id" SERIAL PRIMARY KEY,
  "reference_status" VARCHAR(250) NOT NULL,
  "logical_key" INTEGER NOT NULL,
  "key" INTEGER NOT NULL,
  "name" VARCHAR(250) NOT NULL,
  "label" VARCHAR(250) NOT NULL,
  "color" VARCHAR(10) NOT NULL DEFAULT 'secondary',
  "model_id" INTEGER,
  CONSTRAINT "custom_status_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_type"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "custom_status_custom_key_check" CHECK ("key" > 0 AND "key" <> "logical_key"),
  CONSTRAINT "custom_status_name_check" CHECK ("name" ~ '^[A-Z_][A-Z0-9_]*$'),
  CONSTRAINT "custom_status_color_check" CHECK ("color" IN ('primary', 'secondary', 'success', 'warning', 'danger', 'info', 'dark'))
);
CREATE UNIQUE INDEX "custom_status_reference_status_key_key" ON "custom_status"("reference_status", "key");
CREATE UNIQUE INDEX "custom_status_reference_status_name_key" ON "custom_status"("reference_status", "name");
CREATE INDEX "custom_status_model_id_idx" ON "custom_status"("model_id");

CREATE TABLE "project_code" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "code" VARCHAR(50) NOT NULL,
  "description" VARCHAR(200) NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "responsible_id" INTEGER,
  CONSTRAINT "project_code_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "project_code_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "project_code_code_nonempty_check" CHECK (length(trim("code")) > 0)
);
CREATE UNIQUE INDEX "project_code_code_key" ON "project_code"("code");
CREATE INDEX "project_code_responsible_id_idx" ON "project_code"("responsible_id");

CREATE TABLE "exchange_backend" (
  "name" VARCHAR(255) PRIMARY KEY,
  "last_update" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "base_currency" VARCHAR(3) NOT NULL,
  CONSTRAINT "exchange_backend_currency_check" CHECK ("base_currency" ~ '^[A-Z]{3}$')
);
CREATE TABLE "rate" (
  "id" SERIAL PRIMARY KEY,
  "currency" VARCHAR(3) NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "backend_id" VARCHAR(255) NOT NULL,
  CONSTRAINT "rate_backend_id_fkey" FOREIGN KEY ("backend_id") REFERENCES "exchange_backend"("name") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rate_value_positive_check" CHECK ("value" > 0),
  CONSTRAINT "rate_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX "rate_currency_backend_id_key" ON "rate"("currency", "backend_id");
CREATE INDEX "rate_backend_id_idx" ON "rate"("backend_id");
