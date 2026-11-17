-- CreateTable
CREATE TABLE "stock_item" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
    "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
    "parent_id" INTEGER,
    "part_id" INTEGER NOT NULL,
    "supplier_part_id" INTEGER,
    "location_id" INTEGER,
    "packaging" VARCHAR(50),
    "belongs_to_id" INTEGER,
    "customer_id" INTEGER,
    "serial" VARCHAR(100),
    "serial_int" INTEGER NOT NULL DEFAULT 0,
    "link" VARCHAR(2000) NOT NULL DEFAULT '',
    "batch" VARCHAR(100),
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "is_building" BOOLEAN NOT NULL DEFAULT false,
    "expiry_date" DATE,
    "stocktake_date" DATE,
    "stocktake_user_id" TEXT,
    "creation_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "delete_on_deplete" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER NOT NULL DEFAULT 10,
    "purchase_price" DECIMAL(19,6),
    "owner_id" INTEGER,
    "status_custom_key" INTEGER,
    "purchase_price_currency" VARCHAR(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_item_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "stock_item_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "stock_item_status_check" CHECK ("status" >= 0),
    CONSTRAINT "stock_item_purchase_price_check" CHECK ("purchase_price" IS NULL OR "purchase_price" >= 0),
    CONSTRAINT "stock_item_status_custom_key_check" CHECK ("status_custom_key" IS NULL OR "status_custom_key" >= 0),
    CONSTRAINT "stock_item_version_check" CHECK ("version" >= 0)
);

-- CreateTable
CREATE TABLE "stock_item_tracking" (
    "id" SERIAL NOT NULL,
    "tracking_type" INTEGER NOT NULL DEFAULT 0,
    "item_id" INTEGER,
    "part_id" INTEGER,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(512),
    "user_id" TEXT,
    "deltas" JSONB,

    CONSTRAINT "stock_item_tracking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_item_tracking_deltas_object_check" CHECK ("deltas" IS NULL OR jsonb_typeof("deltas") = 'object')
);

-- CreateTable
CREATE TABLE "part_test_template" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "part_id" INTEGER NOT NULL,
    "test_name" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL DEFAULT '',
    "description" VARCHAR(100),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requires_value" BOOLEAN NOT NULL DEFAULT false,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "choices" VARCHAR(5000) NOT NULL DEFAULT '',

    CONSTRAINT "part_test_template_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "part_test_template_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);

-- CreateTable
CREATE TABLE "stock_item_test_result" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "stock_item_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "result" BOOLEAN NOT NULL DEFAULT false,
    "value" VARCHAR(500) NOT NULL DEFAULT '',
    "attachment" VARCHAR(100),
    "notes" VARCHAR(500) NOT NULL DEFAULT '',
    "user_id" TEXT,
    "test_station" VARCHAR(500) NOT NULL DEFAULT '',
    "started_datetime" TIMESTAMPTZ(6),
    "finished_datetime" TIMESTAMPTZ(6),
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_item_test_result_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_item_test_result_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);

-- CreateIndex
CREATE INDEX "stock_item_part_id_location_id_status_idx" ON "stock_item"("part_id", "location_id", "status");
CREATE INDEX "stock_item_location_id_status_id_idx" ON "stock_item"("location_id", "status", "id");
CREATE INDEX "stock_item_stocktake_user_id_idx" ON "stock_item"("stocktake_user_id");
CREATE INDEX "stock_item_owner_id_idx" ON "stock_item"("owner_id");
CREATE INDEX "stock_item_supplier_part_id_idx" ON "stock_item"("supplier_part_id");
CREATE INDEX "stock_item_customer_id_idx" ON "stock_item"("customer_id");
CREATE INDEX "stock_item_expiry_date_idx" ON "stock_item"("expiry_date");
CREATE INDEX "stock_item_batch_idx" ON "stock_item"("batch");
CREATE INDEX "stock_item_serial_idx" ON "stock_item"("serial");
CREATE INDEX "stock_item_parent_id_idx" ON "stock_item"("parent_id");
CREATE INDEX "stock_item_belongs_to_id_idx" ON "stock_item"("belongs_to_id");
CREATE UNIQUE INDEX "stock_item_unique_part_serial" ON "stock_item"("part_id", "serial") WHERE "serial" IS NOT NULL AND "serial" <> '';

-- CreateIndex
CREATE INDEX "stock_item_tracking_item_id_date_idx" ON "stock_item_tracking"("item_id", "date");
CREATE INDEX "stock_item_tracking_part_id_date_idx" ON "stock_item_tracking"("part_id", "date");
CREATE INDEX "stock_item_tracking_user_id_idx" ON "stock_item_tracking"("user_id");

-- CreateIndex
CREATE INDEX "part_test_template_part_id_idx" ON "part_test_template"("part_id");

-- CreateIndex
CREATE INDEX "stock_item_test_result_stock_item_id_template_id_date_idx" ON "stock_item_test_result"("stock_item_id", "template_id", "date");
CREATE INDEX "stock_item_test_result_user_id_idx" ON "stock_item_test_result"("user_id");
CREATE INDEX "stock_item_test_result_template_id_idx" ON "stock_item_test_result"("template_id");

-- AddForeignKey
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stock_item"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_belongs_to_id_fkey" FOREIGN KEY ("belongs_to_id") REFERENCES "stock_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_supplier_part_id_fkey" FOREIGN KEY ("supplier_part_id") REFERENCES "supplier_part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_location"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_stocktake_user_id_fkey" FOREIGN KEY ("stocktake_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_item"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_test_template" ADD CONSTRAINT "part_test_template_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_item_test_result" ADD CONSTRAINT "stock_item_test_result_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_test_result" ADD CONSTRAINT "stock_item_test_result_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "part_test_template"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_test_result" ADD CONSTRAINT "stock_item_test_result_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

INSERT INTO "model_type" ("app_label", "model")
VALUES
    ('stock', 'stockitemtracking'),
    ('stock', 'stockitemtestresult'),
    ('part', 'parttesttemplate')
ON CONFLICT ("app_label", "model") DO NOTHING;
