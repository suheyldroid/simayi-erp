-- CreateTable
CREATE TABLE "bom_item" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "part_id" INTEGER NOT NULL,
    "sub_part_id" INTEGER NOT NULL,
    "raw_amount" VARCHAR(25) NOT NULL,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "consumable" BOOLEAN NOT NULL DEFAULT false,
    "setup_quantity" DECIMAL(15,5) NOT NULL DEFAULT 0,
    "attrition" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "rounding_multiple" DECIMAL(15,5),
    "piece_count" INTEGER NOT NULL DEFAULT 1,
    "reference" VARCHAR(5000) NOT NULL DEFAULT '',
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "checksum" VARCHAR(128) NOT NULL DEFAULT '',
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "inherited" BOOLEAN NOT NULL DEFAULT false,
    "allow_variants" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bom_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bom_item_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "bom_item_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "bom_item_setup_quantity_check" CHECK ("setup_quantity" >= 0),
    CONSTRAINT "bom_item_attrition_check" CHECK ("attrition" >= 0 AND "attrition" <= 100),
    CONSTRAINT "bom_item_rounding_multiple_check" CHECK ("rounding_multiple" IS NULL OR "rounding_multiple" >= 0),
    CONSTRAINT "bom_item_piece_count_check" CHECK ("piece_count" >= 1)
);

-- CreateTable
CREATE TABLE "bom_item_substitute" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "bom_item_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,

    CONSTRAINT "bom_item_substitute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bom_item_substitute_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);

-- CreateTable
CREATE TABLE "part_sell_price_break" (
    "id" SERIAL NOT NULL,
    "updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "price" DECIMAL(19,6),
    "part_id" INTEGER NOT NULL,
    "price_currency" VARCHAR(3),

    CONSTRAINT "part_sell_price_break_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "part_sell_price_break_quantity_check" CHECK ("quantity" >= 1),
    CONSTRAINT "part_sell_price_break_price_check" CHECK ("price" IS NULL OR "price" >= 0)
);

-- CreateTable
CREATE TABLE "part_internal_price_break" (
    "id" SERIAL NOT NULL,
    "updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(15,5) NOT NULL DEFAULT 1,
    "price" DECIMAL(19,6),
    "part_id" INTEGER NOT NULL,
    "price_currency" VARCHAR(3),

    CONSTRAINT "part_internal_price_break_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "part_internal_price_break_quantity_check" CHECK ("quantity" >= 1),
    CONSTRAINT "part_internal_price_break_price_check" CHECK ("price" IS NULL OR "price" >= 0)
);

-- CreateIndex
CREATE INDEX "bom_item_part_id_idx" ON "bom_item"("part_id");

-- CreateIndex
CREATE INDEX "bom_item_sub_part_id_idx" ON "bom_item"("sub_part_id");

-- CreateIndex
CREATE INDEX "bom_item_substitute_bom_item_id_idx" ON "bom_item_substitute"("bom_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_item_substitute_part_id_bom_item_id_key" ON "bom_item_substitute"("part_id", "bom_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "part_sell_price_break_part_id_quantity_key" ON "part_sell_price_break"("part_id", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "part_internal_price_break_part_id_quantity_key" ON "part_internal_price_break"("part_id", "quantity");

-- AddForeignKey
ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_sub_part_id_fkey" FOREIGN KEY ("sub_part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bom_item_substitute" ADD CONSTRAINT "bom_item_substitute_bom_item_id_fkey" FOREIGN KEY ("bom_item_id") REFERENCES "bom_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bom_item_substitute" ADD CONSTRAINT "bom_item_substitute_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_sell_price_break" ADD CONSTRAINT "part_sell_price_break_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_internal_price_break" ADD CONSTRAINT "part_internal_price_break_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

INSERT INTO "model_type" ("app_label", "model")
VALUES
    ('part', 'bomitemsubstitute'),
    ('part', 'partsellpricebreak'),
    ('part', 'partinternalpricebreak')
ON CONFLICT ("app_label", "model") DO NOTHING;
