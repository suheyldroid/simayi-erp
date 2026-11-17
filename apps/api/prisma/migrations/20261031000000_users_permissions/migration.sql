-- CreateTable
CREATE TABLE "group" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" INTEGER NOT NULL,

    CONSTRAINT "user_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_set" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "group_id" INTEGER NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_add" BOOLEAN NOT NULL DEFAULT false,
    "can_change" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rule_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT,
    "group_id" INTEGER,

    CONSTRAINT "owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "metadata" JSONB,
    "language" VARCHAR(10),
    "theme" JSONB,
    "widgets" JSONB,
    "displayname" VARCHAR(255),
    "position" VARCHAR(255),
    "status" VARCHAR(2000),
    "location" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contact" VARCHAR(255),
    "type" VARCHAR(10) NOT NULL DEFAULT 'internal',
    "organisation" VARCHAR(255),
    "primary_group_id" INTEGER,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_name_key" ON "group"("name");

-- CreateIndex
CREATE INDEX "user_group_group_id_idx" ON "user_group"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_user_id_group_id_key" ON "user_group"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "rule_set_group_id_idx" ON "rule_set"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "rule_set_name_group_id_key" ON "rule_set"("name", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "owner_user_id_key" ON "owner"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "owner_group_id_key" ON "owner"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_user_id_key" ON "user_profile"("user_id");

-- CreateIndex
CREATE INDEX "user_profile_primary_group_id_idx" ON "user_profile"("primary_group_id");

-- AddForeignKey
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_primary_group_id_fkey" FOREIGN KEY ("primary_group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve cross-field invariants independently of the application.
ALTER TABLE "owner" ADD CONSTRAINT "owner_exactly_one_target" CHECK (num_nonnulls("user_id", "group_id") = 1);
ALTER TABLE "group" ADD CONSTRAINT "group_nonblank_name" CHECK (length(btrim("name")) > 0);
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_inheritance" CHECK (
  (NOT ("can_add" OR "can_delete") OR "can_change") AND
  (NOT ("can_change" OR "can_add" OR "can_delete") OR "can_view")
);
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_known_scope" CHECK ("name" IN (
  'admin', 'part_category', 'part', 'bom', 'stock_location', 'stock', 'build',
  'purchase_order', 'sales_order', 'return_order', 'transfer_order'
));
ALTER TABLE "user_profile" ADD CONSTRAINT "profile_metadata_object" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object');
ALTER TABLE "user_profile" ADD CONSTRAINT "profile_known_type" CHECK ("type" IN ('bot', 'internal', 'external', 'guest'));

-- Existing identities receive neutral defaults, never new permissions.
INSERT INTO "user_profile" ("user_id") SELECT "id" FROM "user";
INSERT INTO "owner" ("user_id") SELECT "id" FROM "user";
