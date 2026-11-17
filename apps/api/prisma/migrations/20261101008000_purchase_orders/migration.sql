-- AlterTable
ALTER TABLE "stock_item" ADD COLUMN "purchase_order_id" INTEGER;

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" SERIAL NOT NULL,
    "reference_int" BIGINT NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
    "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "project_code_id" INTEGER,
    "link" VARCHAR(2000) NOT NULL DEFAULT '',
    "start_date" DATE,
    "target_date" DATE,
    "creation_date" DATE,
    "created_by_id" TEXT,
    "issue_date" DATE,
    "updated_at" TIMESTAMPTZ(6),
    "responsible_id" INTEGER,
    "contact_id" INTEGER,
    "address_id" INTEGER,
    "total_price" DECIMAL(19,6),
    "order_currency" VARCHAR(3),
    "reference" VARCHAR(64) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 10,
    "supplier_id" INTEGER,
    "supplier_reference" VARCHAR(64) NOT NULL DEFAULT '',
    "received_by_id" TEXT,
    "complete_date" DATE,
    "destination_id" INTEGER,
    "total_price_currency" VARCHAR(3),
    "status_custom_key" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_order_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "purchase_order_total_price_check" CHECK ("total_price" IS NULL OR "total_price" >= 0),
    CONSTRAINT "purchase_order_status_check" CHECK ("status" >= 0),
    CONSTRAINT "purchase_order_status_custom_key_check" CHECK ("status_custom_key" IS NULL OR "status_custom_key" >= 0),
    CONSTRAINT "purchase_order_version_check" CHECK ("version" >= 0)
);

-- CreateTable
CREATE TABLE "purchase_order_line_item" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line" VARCHAR(20) NOT NULL DEFAULT '',
    "line_int" INTEGER NOT NULL DEFAULT 0,
    "reference" VARCHAR(100) NOT NULL DEFAULT '',
    "notes" VARCHAR(500) NOT NULL DEFAULT '',
    "link" VARCHAR(2000) NOT NULL DEFAULT '',
    "target_date" DATE,
    "project_code_id" INTEGER,
    "order_id" INTEGER NOT NULL,
    "part_id" INTEGER,
    "received" DECIMAL(15,5) NOT NULL DEFAULT 0,
    "purchase_price" DECIMAL(19,6),
    "destination_id" INTEGER,
    "purchase_price_currency" VARCHAR(3),

    CONSTRAINT "purchase_order_line_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_order_line_item_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "purchase_order_line_item_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "purchase_order_line_item_discount_min_check" CHECK ("discount" >= 0),
    CONSTRAINT "purchase_order_line_item_discount_max_check" CHECK ("discount" <= 100),
    CONSTRAINT "purchase_order_line_item_received_check" CHECK ("received" >= 0),
    CONSTRAINT "purchase_order_line_item_purchase_price_check" CHECK ("purchase_price" IS NULL OR "purchase_price" >= 0)
);

-- CreateTable
CREATE TABLE "purchase_order_extra_line" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "line" VARCHAR(20) NOT NULL DEFAULT '',
    "line_int" INTEGER NOT NULL DEFAULT 0,
    "reference" VARCHAR(100) NOT NULL DEFAULT '',
    "notes" VARCHAR(500) NOT NULL DEFAULT '',
    "link" VARCHAR(2000) NOT NULL DEFAULT '',
    "target_date" DATE,
    "project_code_id" INTEGER,
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "context" JSONB,
    "price" DECIMAL(19,6),
    "order_id" INTEGER NOT NULL,
    "price_currency" VARCHAR(3),

    CONSTRAINT "purchase_order_extra_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_order_extra_line_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "purchase_order_extra_line_context_object_check" CHECK ("context" IS NULL OR jsonb_typeof("context") = 'object'),
    CONSTRAINT "purchase_order_extra_line_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "purchase_order_extra_line_discount_min_check" CHECK ("discount" >= 0),
    CONSTRAINT "purchase_order_extra_line_discount_max_check" CHECK ("discount" <= 100),
    CONSTRAINT "purchase_order_extra_line_price_check" CHECK ("price" IS NULL OR "price" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_reference_key" ON "purchase_order"("reference");
CREATE INDEX "purchase_order_supplier_id_status_idx" ON "purchase_order"("supplier_id", "status");
CREATE INDEX "purchase_order_status_target_date_idx" ON "purchase_order"("status", "target_date");
CREATE INDEX "purchase_order_address_id_idx" ON "purchase_order"("address_id");
CREATE INDEX "purchase_order_created_by_id_idx" ON "purchase_order"("created_by_id");
CREATE INDEX "purchase_order_project_code_id_idx" ON "purchase_order"("project_code_id");
CREATE INDEX "purchase_order_destination_id_idx" ON "purchase_order"("destination_id");
CREATE INDEX "purchase_order_responsible_id_idx" ON "purchase_order"("responsible_id");
CREATE INDEX "purchase_order_contact_id_idx" ON "purchase_order"("contact_id");
CREATE INDEX "purchase_order_received_by_id_idx" ON "purchase_order"("received_by_id");

-- CreateIndex
CREATE INDEX "purchase_order_line_item_part_id_idx" ON "purchase_order_line_item"("part_id");
CREATE INDEX "purchase_order_line_item_destination_id_idx" ON "purchase_order_line_item"("destination_id");
CREATE INDEX "purchase_order_line_item_project_code_id_idx" ON "purchase_order_line_item"("project_code_id");
CREATE INDEX "purchase_order_line_item_order_id_idx" ON "purchase_order_line_item"("order_id");

-- CreateIndex
CREATE INDEX "purchase_order_extra_line_order_id_idx" ON "purchase_order_extra_line"("order_id");
CREATE INDEX "purchase_order_extra_line_project_code_id_idx" ON "purchase_order_extra_line"("project_code_id");
CREATE INDEX "stock_item_purchase_order_id_idx" ON "stock_item"("purchase_order_id");

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_project_code_id_fkey" FOREIGN KEY ("project_code_id") REFERENCES "project_code"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_project_code_id_fkey" FOREIGN KEY ("project_code_id") REFERENCES "project_code"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "supplier_part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchase_order_extra_line" ADD CONSTRAINT "purchase_order_extra_line_project_code_id_fkey" FOREIGN KEY ("project_code_id") REFERENCES "project_code"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_extra_line" ADD CONSTRAINT "purchase_order_extra_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

INSERT INTO "model_type" ("app_label", "model")
VALUES
    ('order', 'purchaseorder'),
    ('order', 'purchaseorderlineitem'),
    ('order', 'purchaseorderextraline')
ON CONFLICT ("app_label", "model") DO NOTHING;
