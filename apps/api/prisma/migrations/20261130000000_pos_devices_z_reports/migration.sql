-- Bank POS devices and their nested Z reports.
-- Forward additive migration for the state produced by
-- 20261129000000_purchase_finance_holds. It does not record that it was applied
-- and it has not been executed against any database by this change. Prisma does
-- not wrap a PostgreSQL migration in a transaction, so this file is one
-- explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * additive only: two new tables with their indexes, composite organization
--     foreign keys and shape checks. No existing table, row, column or value is
--     created, rewritten or deleted.
--   * one report references one POS device and at most one sales batch; a batch
--     may have many reports, partial coverage is expected, and a report with a
--     NULL batch is deliberately unmatched. There is no sale-level link,
--     allocation, split, matching or settlement.
--   * `pos_device_z_report.currency_code` is a creation-time snapshot of the
--     system currency. No finance, money-movement or organization-finance row
--     is read for writing or changed here.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that reads the new tables.

BEGIN;

CREATE TABLE "pos_device" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "bank_name" VARCHAR(100) NOT NULL,
  "terminal_id" VARCHAR(100) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "pos_device_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_device_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "pos_device_name_check" CHECK (btrim("name") <> ''),
  CONSTRAINT "pos_device_bank_name_check" CHECK (btrim("bank_name") <> ''),
  CONSTRAINT "pos_device_terminal_id_check" CHECK (btrim("terminal_id") <> ''),
  CONSTRAINT "pos_device_version_check" CHECK ("version" >= 0)
);

CREATE UNIQUE INDEX "pos_device_uuid_key" ON "pos_device"("uuid");
CREATE UNIQUE INDEX "pos_device_organization_id_id_key"
  ON "pos_device"("organization_id", "id");
CREATE INDEX "pos_device_organization_id_active_id_idx"
  ON "pos_device"("organization_id", "active", "id");

CREATE TABLE "pos_device_z_report" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "pos_device_id" INTEGER NOT NULL,
  "sales_batch_id" INTEGER,
  "report_number" VARCHAR(100) NOT NULL,
  "business_date" DATE NOT NULL,
  "closed_at" TIMESTAMPTZ(6) NOT NULL,
  "total_amount" DECIMAL(19,6) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "note" VARCHAR(500) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "pos_device_z_report_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_device_z_report_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "pos_device_z_report_organization_id_pos_device_id_fkey"
    FOREIGN KEY ("organization_id", "pos_device_id")
    REFERENCES "pos_device"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "pos_device_z_report_organization_id_sales_batch_id_fkey"
    FOREIGN KEY ("organization_id", "sales_batch_id")
    REFERENCES "sales_batch"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "pos_device_z_report_report_number_check"
    CHECK (btrim("report_number") <> ''),
  CONSTRAINT "pos_device_z_report_total_amount_check"
    CHECK ("total_amount" >= 0),
  CONSTRAINT "pos_device_z_report_currency_code_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "pos_device_z_report_version_check" CHECK ("version" >= 0)
);

CREATE UNIQUE INDEX "pos_device_z_report_uuid_key"
  ON "pos_device_z_report"("uuid");
CREATE UNIQUE INDEX "pos_device_z_report_organization_id_id_key"
  ON "pos_device_z_report"("organization_id", "id");
CREATE UNIQUE INDEX "pos_device_z_report_identity_key"
  ON "pos_device_z_report"("organization_id", "pos_device_id", "report_number");
CREATE INDEX "pos_device_z_report_organization_id_pos_device_id_id_idx"
  ON "pos_device_z_report"("organization_id", "pos_device_id", "id");
CREATE INDEX "pos_device_z_report_organization_id_sales_batch_id_idx"
  ON "pos_device_z_report"("organization_id", "sales_batch_id");

COMMIT;
