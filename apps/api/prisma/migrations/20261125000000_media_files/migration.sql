-- Central disk-backed media metadata.
-- Forward-only, additive migration for the state produced by
-- 20261124000000_remove_opening_balances. It creates one new table with its
-- indexes and constraints and changes no existing table, row, or column. It
-- has not been executed against any database by this change. Prisma does not
-- wrap a PostgreSQL migration in a transaction, so this file is one explicit
-- BEGIN/COMMIT block.
--
-- Scope:
--   * `media_file` indexes every binary object stored under the private
--     `MEDIA_ROOT` directory. The bytes stay on disk; this table stores only
--     metadata (server-generated storage key, original name, verified content
--     type, byte size, purpose, uploader, optional organization scope) and no
--     file content, base64, or absolute path.
--   * Internal integer `id` stays the relational key; public identity is the
--     database-generated UUID.
--   * Lifecycle: 10 temporary (uploader-owned, unclaimed, has an expiry),
--     20 attached (claimed, no expiry; `organization_id` records the owner and
--     becomes null when that organization is deleted, so the row is orphaned
--     for deferred cleanup instead of blocking the delete), 30 deleting
--     (deferred cleanup in progress or failed and retryable).
--   * `reference` stores the exact public binding, for example
--     `/media/<uuid>` for the organization logo.
--   * The organization logo claim/release triggers below claim, release, and
--     validate organization logos inside the native organization
--     INSERT/UPDATE/DELETE transaction. This is the concurrency boundary
--     between a native logo write and deferred cleanup.
--   * `storage_key` is written only by the server as
--     `<purpose>/<uuid>.<png|jpg|webp>`. The check rejects an empty key, an
--     absolute key, and any parent-directory segment, so a row can never point
--     outside the configured media root.
--   * `delete_attempts` and `last_delete_error` keep retry metadata when the
--     filesystem delete fails; the row is not removed until the file is gone.
--   * No existing image, workbook, or logo row is touched. Existing files keep
--     their current paths and are not backfilled by this migration.
--
-- Uniqueness: `storage_key` and `uuid` are unique, so one disk object and one
-- public identity map to exactly one row.
--
-- Deployment: this migration is additive and creates no row. Apply it before
-- starting code that writes `media_file` rows.

BEGIN;

CREATE TABLE "media_file" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storage_key" VARCHAR(160) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "content_type" VARCHAR(80) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "purpose" VARCHAR(32) NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 10,
  "organization_id" TEXT,
  "uploader_id" TEXT,
  "reference" VARCHAR(160),
  "expires_at" TIMESTAMPTZ(6),
  "claimed_at" TIMESTAMPTZ(6),
  "delete_started_at" TIMESTAMPTZ(6),
  "delete_attempts" INTEGER NOT NULL DEFAULT 0,
  "last_delete_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "media_file_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_file_uuid_key" ON "media_file"("uuid");
CREATE UNIQUE INDEX "media_file_storage_key_key" ON "media_file"("storage_key");
CREATE INDEX "media_file_status_expires_at_idx"
  ON "media_file"("status", "expires_at");
CREATE INDEX "media_file_status_delete_started_at_idx"
  ON "media_file"("status", "delete_started_at");
CREATE INDEX "media_file_organization_id_status_idx"
  ON "media_file"("organization_id", "status");
-- One stored object may serve at most one domain binding (single binding
-- ownership). Temporary rows have a null reference and are unaffected because
-- PostgreSQL treats NULLs as distinct in a unique index.
CREATE UNIQUE INDEX "media_file_organization_id_purpose_reference_key"
  ON "media_file"("organization_id", "purpose", "reference");
CREATE INDEX "media_file_uploader_id_status_idx"
  ON "media_file"("uploader_id", "status");

ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_uploader_id_fkey"
  FOREIGN KEY ("uploader_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_status_check"
  CHECK ("status" IN (10, 20, 30));
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_purpose_check"
  CHECK ("purpose" IN ('organization-logo', 'item-image', 'supplier-image', 'sales-batch-workbook'));
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_byte_size_check"
  CHECK ("byte_size" > 0);
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_original_name_check"
  CHECK ("original_name" <> '');
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_storage_key_check"
  CHECK (
    "storage_key" <> ''
    AND left("storage_key", 1) <> '/'
    AND position('..' in "storage_key") = 0
  );
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_attached_check"
  CHECK ("status" <> 20 OR "claimed_at" IS NOT NULL);
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_expiry_check"
  CHECK ("status" = 20 OR "expires_at" IS NOT NULL);
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_deleting_check"
  CHECK ("status" <> 30 OR "delete_started_at" IS NOT NULL);
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_delete_attempts_check"
  CHECK ("delete_attempts" >= 0);

-- Atomic logo binding.
--
-- Native organization persistence and the logo claim must be one transaction,
-- but Better Auth's organization hooks receive no database context
-- (`beforeCreateOrganization`/`beforeUpdateOrganization` get only the payload,
-- user, and member), and the plugin performs the insert/update through the
-- adapter after those hooks. The trigger therefore runs inside the adapter's
-- own organization INSERT/UPDATE statement, which is the only transaction that
-- covers both the organization row and this metadata.
--
-- INSERT runs AFTER so the organization row exists before `media_file` is
-- updated with its id (the foreign key is immediate, not deferrable). UPDATE
-- and DELETE run BEFORE, where the organization row already exists. All three
-- run inside the adapter's own statement/transaction; a raised exception rolls
-- the native write back.
--
-- INSERT / UPDATE OF logo:
--   * a canonical `/media/<uuid>` value claims that exact unexpired temporary
--     row (`status` 10, no owner, organization-logo purpose) with a conditional
--     UPDATE; two concurrent requests race on that row lock and exactly one
--     wins, the loser aborts the whole native write instead of persisting a
--     logo it does not own;
--   * an already-attached row of the same organization is idempotent;
--   * every other attached logo of the organization is released (status 30)
--     in the same transaction, so removing/replacing a logo is atomic;
--   * a new or changed non-canonical value (data URI, external URL, anything
--     else) is rejected; an unchanged historical value is allowed to remain
--     until the operational import runs, and a native update that omits the
--     column never fires this trigger;
--   * a missing, expired, already-bound, wrong-purpose, or deleting row aborts
--     the native write.
--
-- DELETE releases every attached file of the organization (logo, item and
-- supplier images, workbook sources) before the foreign key clears
-- `organization_id`, so an organization deletion is never blocked and leaves
-- only retryable cleanup rows.
CREATE FUNCTION "media_file_sync_organization_logo"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  reference text;
  media_uuid uuid;
  changed integer;
  already_owned boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "media_file"
       SET "status" = 30,
           "delete_started_at" = CURRENT_TIMESTAMP,
           "expires_at" = CURRENT_TIMESTAMP,
           "updated_at" = CURRENT_TIMESTAMP
     WHERE "organization_id" = OLD."id"
       AND "status" = 20;
    RETURN OLD;
  END IF;

  reference := NEW."logo";

  IF reference IS NOT NULL
     AND reference <> ''
     AND reference !~ '^/media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'organization logo must be an existing /media/<uuid> upload'
        USING ERRCODE = 'P0001';
    ELSE
      IF NEW."logo" IS DISTINCT FROM OLD."logo" THEN
        RAISE EXCEPTION 'organization logo must be an existing /media/<uuid> upload'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF reference IS NOT NULL
     AND reference ~ '^/media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    media_uuid := substr(reference, 8)::uuid;

    SELECT EXISTS (
      SELECT 1
      FROM "media_file"
      WHERE "uuid" = media_uuid
        AND "organization_id" = NEW."id"
        AND "purpose" = 'organization-logo'
        AND "status" = 20
    ) INTO already_owned;

    IF NOT already_owned THEN
      UPDATE "media_file"
         SET "status" = 20,
             "organization_id" = NEW."id",
             "claimed_at" = CURRENT_TIMESTAMP,
             "expires_at" = NULL,
             "delete_started_at" = NULL,
             "reference" = reference,
             "updated_at" = CURRENT_TIMESTAMP
       WHERE "uuid" = media_uuid
         AND "purpose" = 'organization-logo'
         AND "status" = 10
         AND "organization_id" IS NULL
         AND "expires_at" IS NOT NULL
         AND "expires_at" > CURRENT_TIMESTAMP;
      GET DIAGNOSTICS changed = ROW_COUNT;
      IF changed <> 1 THEN
        RAISE EXCEPTION 'organization logo upload is not claimable'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE "media_file"
       SET "status" = 30,
           "delete_started_at" = CURRENT_TIMESTAMP,
           "expires_at" = CURRENT_TIMESTAMP,
           "updated_at" = CURRENT_TIMESTAMP
     WHERE "organization_id" = NEW."id"
       AND "purpose" = 'organization-logo'
       AND "status" = 20
       AND "uuid" <> media_uuid;
  ELSE
    UPDATE "media_file"
       SET "status" = 30,
           "delete_started_at" = CURRENT_TIMESTAMP,
           "expires_at" = CURRENT_TIMESTAMP,
           "updated_at" = CURRENT_TIMESTAMP
     WHERE "organization_id" = NEW."id"
       AND "purpose" = 'organization-logo'
       AND "status" = 20;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "organization_logo_media_claim_insert"
  AFTER INSERT ON "organization"
  FOR EACH ROW EXECUTE FUNCTION "media_file_sync_organization_logo"();

CREATE TRIGGER "organization_logo_media_claim_update"
  BEFORE UPDATE OF "logo" ON "organization"
  FOR EACH ROW EXECUTE FUNCTION "media_file_sync_organization_logo"();

CREATE TRIGGER "organization_logo_media_release"
  BEFORE DELETE ON "organization"
  FOR EACH ROW EXECUTE FUNCTION "media_file_sync_organization_logo"();

COMMIT;
