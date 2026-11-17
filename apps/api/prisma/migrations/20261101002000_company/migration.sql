CREATE TABLE "company" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "image" VARCHAR(100),
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "website" VARCHAR(2000) NOT NULL DEFAULT '',
  "phone" VARCHAR(50) NOT NULL DEFAULT '',
  "email" VARCHAR(254),
  "contact" VARCHAR(100) NOT NULL DEFAULT '',
  "link" VARCHAR(2000) NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "is_customer" BOOLEAN NOT NULL DEFAULT false,
  "is_supplier" BOOLEAN NOT NULL DEFAULT true,
  "is_manufacturer" BOOLEAN NOT NULL DEFAULT false,
  "currency" VARCHAR(3) NOT NULL,
  "tax_id" VARCHAR(50) NOT NULL DEFAULT '',
  CONSTRAINT "company_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "company_name_nonempty_check" CHECK (length(trim("name")) > 0),
  CONSTRAINT "company_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "company_role_check" CHECK ("is_customer" OR "is_supplier" OR "is_manufacturer")
);
CREATE UNIQUE INDEX "company_name_email_key" ON "company"("name", "email");

CREATE TABLE "contact" (
  "id" SERIAL PRIMARY KEY,
  "metadata" JSONB,
  "company_id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(100) NOT NULL DEFAULT '',
  "email" VARCHAR(254) NOT NULL DEFAULT '',
  "role" VARCHAR(100) NOT NULL DEFAULT '',
  CONSTRAINT "contact_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contact_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "contact_name_nonempty_check" CHECK (length(trim("name")) > 0)
);
CREATE INDEX "contact_company_id_idx" ON "contact"("company_id");

CREATE TABLE "address" (
  "id" SERIAL PRIMARY KEY,
  "company_id" INTEGER NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "line1" VARCHAR(50) NOT NULL DEFAULT '',
  "line2" VARCHAR(50) NOT NULL DEFAULT '',
  "postal_code" VARCHAR(10) NOT NULL DEFAULT '',
  "postal_city" VARCHAR(50) NOT NULL DEFAULT '',
  "province" VARCHAR(50) NOT NULL DEFAULT '',
  "country" VARCHAR(50) NOT NULL DEFAULT '',
  "shipping_notes" VARCHAR(100) NOT NULL DEFAULT '',
  "internal_shipping_notes" VARCHAR(100) NOT NULL DEFAULT '',
  "link" VARCHAR(2000) NOT NULL DEFAULT '',
  CONSTRAINT "address_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "address_title_nonempty_check" CHECK (length(trim("title")) > 0)
);
CREATE INDEX "address_company_id_idx" ON "address"("company_id");
CREATE UNIQUE INDEX "address_one_primary_per_company" ON "address"("company_id") WHERE "primary";

INSERT INTO "model_type" ("app_label", "model") VALUES
  ('company', 'company'), ('company', 'contact'), ('company', 'address');
