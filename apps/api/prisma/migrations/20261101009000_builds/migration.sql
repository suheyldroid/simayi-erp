-- AlterTable
ALTER TABLE "stock_item" ADD COLUMN "build_id" INTEGER;
ALTER TABLE "stock_item" ADD COLUMN "consumed_by_id" INTEGER;

-- CreateTable
CREATE TABLE "build" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "reference_int" BIGINT NOT NULL DEFAULT 0,
    "barcode_data" VARCHAR(500) NOT NULL DEFAULT '',
    "barcode_hash" VARCHAR(128) NOT NULL DEFAULT '',
    "reference" VARCHAR(64) NOT NULL,
    "title" VARCHAR(100) NOT NULL DEFAULT '',
    "parent_id" INTEGER,
    "part_id" INTEGER NOT NULL,
    "take_from_id" INTEGER,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "destination_id" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 10,
    "batch" VARCHAR(100),
    "creation_date" DATE NOT NULL,
    "start_date" DATE,
    "target_date" DATE,
    "completion_date" DATE,
    "completed_by_id" TEXT,
    "issued_by_id" TEXT,
    "responsible_id" INTEGER,
    "link" VARCHAR(2000) NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "project_code_id" INTEGER,
    "status_custom_key" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "build_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "build_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "build_quantity_non_negative_check" CHECK ("quantity" >= 0),
    CONSTRAINT "build_quantity_check" CHECK ("quantity" >= 1),
    CONSTRAINT "build_completed_check" CHECK ("completed" >= 0),
    CONSTRAINT "build_status_check" CHECK ("status" >= 0),
    CONSTRAINT "build_priority_check" CHECK ("priority" >= 0),
    CONSTRAINT "build_status_custom_key_check" CHECK ("status_custom_key" IS NULL OR "status_custom_key" >= 0),
    CONSTRAINT "build_version_check" CHECK ("version" >= 0)
);

-- CreateTable
CREATE TABLE "build_line" (
    "id" SERIAL NOT NULL,
    "build_id" INTEGER NOT NULL,
    "bom_item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "consumed" DECIMAL(15,5) NOT NULL DEFAULT 0,

    CONSTRAINT "build_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "build_line_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "build_line_consumed_check" CHECK ("consumed" >= 0)
);

-- CreateTable
CREATE TABLE "build_item" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "build_line_id" INTEGER,
    "stock_item_id" INTEGER NOT NULL,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "install_into_id" INTEGER,

    CONSTRAINT "build_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "build_item_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "build_item_quantity_check" CHECK ("quantity" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "build_reference_key" ON "build"("reference");
CREATE INDEX "build_part_id_status_idx" ON "build"("part_id", "status");
CREATE INDEX "build_status_target_date_idx" ON "build"("status", "target_date");
CREATE INDEX "build_destination_id_idx" ON "build"("destination_id");
CREATE INDEX "build_issued_by_id_idx" ON "build"("issued_by_id");
CREATE INDEX "build_project_code_id_idx" ON "build"("project_code_id");
CREATE INDEX "build_completed_by_id_idx" ON "build"("completed_by_id");
CREATE INDEX "build_responsible_id_idx" ON "build"("responsible_id");
CREATE INDEX "build_parent_id_idx" ON "build"("parent_id");
CREATE INDEX "build_take_from_id_idx" ON "build"("take_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "build_line_build_id_bom_item_id_key" ON "build_line"("build_id", "bom_item_id");
CREATE INDEX "build_line_bom_item_id_idx" ON "build_line"("bom_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "build_item_build_line_id_stock_item_id_install_into_id_key" ON "build_item"("build_line_id", "stock_item_id", "install_into_id");
CREATE INDEX "build_item_install_into_id_idx" ON "build_item"("install_into_id");
CREATE INDEX "build_item_stock_item_id_idx" ON "build_item"("stock_item_id");
CREATE INDEX "stock_item_build_id_idx" ON "stock_item"("build_id");
CREATE INDEX "stock_item_consumed_by_id_idx" ON "stock_item"("consumed_by_id");

-- AddForeignKey
ALTER TABLE "build" ADD CONSTRAINT "build_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "build"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_take_from_id_fkey" FOREIGN KEY ("take_from_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "stock_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_project_code_id_fkey" FOREIGN KEY ("project_code_id") REFERENCES "project_code"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "build_line" ADD CONSTRAINT "build_line_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "build"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_line" ADD CONSTRAINT "build_line_bom_item_id_fkey" FOREIGN KEY ("bom_item_id") REFERENCES "bom_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_build_line_id_fkey" FOREIGN KEY ("build_line_id") REFERENCES "build_line"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_install_into_id_fkey" FOREIGN KEY ("install_into_id") REFERENCES "stock_item"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "build"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_consumed_by_id_fkey" FOREIGN KEY ("consumed_by_id") REFERENCES "build"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

INSERT INTO "model_type" ("app_label", "model")
VALUES
    ('build', 'build'),
    ('build', 'buildline'),
    ('build', 'builditem')
ON CONFLICT ("app_label", "model") DO NOTHING;
