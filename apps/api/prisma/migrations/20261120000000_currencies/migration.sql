-- Organization currency preference and purchase-order currency.
-- Forward migration; it does not record that it was applied and it has not
-- been executed against any database by this change. Prisma does not wrap a
-- PostgreSQL migration in a transaction, so this file is one explicit
-- BEGIN/COMMIT block.
--
-- Scope:
--   * `organization_preference` holds application-owned defaults per native
--     Better Auth organization. The native `organization` table is not
--     altered. A missing row means "no preference stored"; it is never
--     created by a read.
--   * `purchase_order.currency_code` is nullable. Existing orders keep NULL,
--     which the API reports as an unknown currency. No historical price,
--     total or currency is guessed, defaulted or converted.
--   * the check constraints only assert the canonical uppercase ISO 4217
--     shape for values that are present; they deliberately do not embed a
--     currency code list, so no external rate or reference service is needed.
--
-- Deployment: apply with all writers stopped, then start the code that
-- resolves the organization default and validates codes against the server
-- catalog.

BEGIN;

LOCK TABLE "purchase_order" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "organization_preference" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "default_currency_code" VARCHAR(3),

  CONSTRAINT "organization_preference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_preference_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_preference_default_currency_code_check"
    CHECK (
      "default_currency_code" IS NULL
      OR "default_currency_code" ~ '^[A-Z]{3}$'
    )
);

CREATE UNIQUE INDEX "organization_preference_uuid_key"
  ON "organization_preference"("uuid");
CREATE UNIQUE INDEX "organization_preference_organization_id_key"
  ON "organization_preference"("organization_id");

ALTER TABLE "purchase_order" ADD COLUMN "currency_code" VARCHAR(3);

ALTER TABLE "purchase_order"
  ADD CONSTRAINT "purchase_order_currency_code_check"
  CHECK ("currency_code" IS NULL OR "currency_code" ~ '^[A-Z]{3}$');

COMMIT;
