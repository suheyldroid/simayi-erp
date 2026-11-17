-- Personal dashboard layouts, one saved definition per account and context.
-- This is a forward-only, additive migration: it creates one new table and
-- its indexes/constraints and changes no existing table, row or column.
--
-- Scope:
--   * `dashboard.organization_id` is null for the account-wide global
--     dashboard and non-null for that account's personal dashboard inside one
--     organization;
--   * internal integer `id` stays the relational key; public identity is the
--     database-generated UUID;
--   * `schema_version` versions the JSON layout shape and starts at 1;
--   * `revision` is the optimistic-concurrency counter and starts at 1;
--   * `definition` is a validated JSON object; widget configuration UUIDs are
--     client-generated values inside that JSON, not rows in this table.
--
-- Uniqueness:
--   * `(user_id, organization_id)` is a regular unique index, which covers
--     every organization-scoped dashboard;
--   * PostgreSQL treats NULL values as distinct, so the compound index alone
--     would allow several global rows per user. The partial unique index
--     `dashboard_user_global_key` enforces exactly one global dashboard per
--     user, including the NULL organization scope.

BEGIN;

CREATE TABLE "dashboard" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "organization_id" TEXT,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "definition" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "dashboard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dashboard_uuid_key" ON "dashboard"("uuid");
CREATE UNIQUE INDEX "dashboard_user_id_organization_id_key"
  ON "dashboard"("user_id", "organization_id");
CREATE UNIQUE INDEX "dashboard_user_global_key"
  ON "dashboard"("user_id")
  WHERE "organization_id" IS NULL;
CREATE INDEX "dashboard_organization_id_idx" ON "dashboard"("organization_id");

ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_schema_version_check"
  CHECK ("schema_version" = 1);
ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_revision_check"
  CHECK ("revision" >= 1);
ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_definition_object_check"
  CHECK (jsonb_typeof("definition") = 'object');

COMMIT;
