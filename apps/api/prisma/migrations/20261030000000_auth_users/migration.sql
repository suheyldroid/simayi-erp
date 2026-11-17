-- Add identity flags without changing existing user IDs or removing data.
ALTER TABLE "user"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isStaff" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isSuperuser" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");
