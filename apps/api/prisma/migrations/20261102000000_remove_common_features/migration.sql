-- Drop configurable common features. Built-in status integers, part and
-- parameter unit strings, ModelType rows, and existing order and build
-- reference values stay. Custom labels, project links, unit definitions,
-- and stored setting overrides are discarded.
--
-- The file is one transaction. Prisma does not make a PostgreSQL migration
-- atomic by itself. Any later failure rolls the whole scope back.
--
-- Run this during a maintenance window, after a backup, with writers stopped.

BEGIN;

ALTER TABLE "purchase_order" DROP CONSTRAINT "purchase_order_project_code_id_same_org_fkey";
ALTER TABLE "purchase_order" DROP CONSTRAINT "purchase_order_project_code_id_fkey";
DROP INDEX "purchase_order_project_code_id_idx";
ALTER TABLE "purchase_order" DROP COLUMN "project_code_id";
ALTER TABLE "purchase_order" DROP CONSTRAINT "purchase_order_status_custom_key_check";
ALTER TABLE "purchase_order" DROP COLUMN "status_custom_key";

ALTER TABLE "purchase_order_line_item" DROP CONSTRAINT "purchase_order_line_item_project_code_id_same_org_fkey";
ALTER TABLE "purchase_order_line_item" DROP CONSTRAINT "purchase_order_line_item_project_code_id_fkey";
DROP INDEX "purchase_order_line_item_project_code_id_idx";
ALTER TABLE "purchase_order_line_item" DROP COLUMN "project_code_id";

ALTER TABLE "purchase_order_extra_line" DROP CONSTRAINT "purchase_order_extra_line_project_code_id_same_org_fkey";
ALTER TABLE "purchase_order_extra_line" DROP CONSTRAINT "purchase_order_extra_line_project_code_id_fkey";
DROP INDEX "purchase_order_extra_line_project_code_id_idx";
ALTER TABLE "purchase_order_extra_line" DROP COLUMN "project_code_id";

ALTER TABLE "build" DROP CONSTRAINT "build_project_code_id_same_org_fkey";
ALTER TABLE "build" DROP CONSTRAINT "build_project_code_id_fkey";
DROP INDEX "build_project_code_id_idx";
ALTER TABLE "build" DROP COLUMN "project_code_id";
ALTER TABLE "build" DROP CONSTRAINT "build_status_custom_key_check";
ALTER TABLE "build" DROP COLUMN "status_custom_key";

ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_status_custom_key_check";
ALTER TABLE "stock_item" DROP COLUMN "status_custom_key";

DROP TABLE "custom_status";
DROP TABLE "custom_unit";
DROP TABLE "system_setting";
DROP TABLE "user_setting";
DROP TABLE "project_code";

COMMIT;
