-- Global account avatar media and its native user lifecycle.
--
-- Forward-only migration for the state produced by the applied
-- `20261125000000_media_files` and `20261126000000_fix_media_logo_trigger_reference`
-- migrations. Those files are not modified. This migration:
--
--   * adds the `user-avatar` purpose to `media_file` (purpose check only);
--   * creates one trigger function that atomically binds, replaces, removes,
--     and releases avatar files in the same transaction as the native user
--     write, with variable names that cannot collide with `media_file` columns.
--
-- Native `User.image` stores only the canonical public reference
-- `/media/avatars/<uuid>`. The avatar is uploaded by its account through
-- `/media/temporary-avatar`; a temp row is uploader-owned, organization-less,
-- and expires. The trigger claims it only for that same uploader account.
-- Reusing another account's avatar, a non-avatar purpose, an expired/deleting
-- row, or a new arbitrary URL/base64 aborts the native write. An unchanged
-- historical external value is allowed to remain until the UI migrates it, but
-- it can never be introduced or changed through this path.
--
-- ORDERING: INSERT runs AFTER so the `media_file.uploader_id` foreign key sees
-- the created user row. UPDATE and DELETE run BEFORE, where the user row
-- already exists. Postgres resolves every identifier below without a
-- column/variable collision.
--
-- Prisma does not wrap a PostgreSQL migration in a transaction, so this file
-- is one explicit BEGIN/COMMIT block. It has not been executed by this change.

BEGIN;

ALTER TABLE "media_file" DROP CONSTRAINT "media_file_purpose_check";
ALTER TABLE "media_file"
  ADD CONSTRAINT "media_file_purpose_check"
  CHECK ("purpose" IN (
    'organization-logo',
    'item-image',
    'supplier-image',
    'sales-batch-workbook',
    'user-avatar'
  ));

CREATE FUNCTION "media_file_sync_user_avatar"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  avatar_reference text;
  avatar_uuid uuid;
  changed integer;
  already_owned boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "media_file"
       SET "status" = 30,
           "delete_started_at" = CURRENT_TIMESTAMP,
           "expires_at" = CURRENT_TIMESTAMP,
           "updated_at" = CURRENT_TIMESTAMP
     WHERE "uploader_id" = OLD."id"
       AND "purpose" = 'user-avatar'
       AND "status" = 20;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- No avatar upload can belong to an account that did not exist yet.
    IF NEW."image" IS NOT NULL AND NEW."image" <> '' THEN
      RAISE EXCEPTION 'user avatar must be uploaded by the account before it is created'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  avatar_reference := NEW."image";

  IF avatar_reference IS NOT NULL
     AND avatar_reference <> ''
     AND avatar_reference !~ '^/media/avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    IF NEW."image" IS DISTINCT FROM OLD."image" THEN
      RAISE EXCEPTION 'user avatar must be an uploaded /media/avatars/<uuid> file'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF avatar_reference IS NOT NULL
     AND avatar_reference ~ '^/media/avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    avatar_uuid := substr(avatar_reference, 16)::uuid;

    SELECT EXISTS (
      SELECT 1
      FROM "media_file"
      WHERE "uuid" = avatar_uuid
        AND "uploader_id" = NEW."id"
        AND "purpose" = 'user-avatar'
        AND "organization_id" IS NULL
        AND "status" = 20
    ) INTO already_owned;

    -- Single current avatar: release every other attached avatar first. The
    -- user row lock serializes concurrent native writes for this account.
    UPDATE "media_file"
       SET "status" = 30,
           "delete_started_at" = CURRENT_TIMESTAMP,
           "expires_at" = CURRENT_TIMESTAMP,
           "updated_at" = CURRENT_TIMESTAMP
     WHERE "uploader_id" = NEW."id"
       AND "purpose" = 'user-avatar'
       AND "status" = 20
       AND "uuid" <> avatar_uuid;

    IF NOT already_owned THEN
      UPDATE "media_file"
         SET "status" = 20,
             "reference" = avatar_reference,
             "claimed_at" = CURRENT_TIMESTAMP,
             "expires_at" = NULL,
             "delete_started_at" = NULL,
             "updated_at" = CURRENT_TIMESTAMP
       WHERE "uuid" = avatar_uuid
         AND "uploader_id" = NEW."id"
         AND "purpose" = 'user-avatar'
         AND "organization_id" IS NULL
         AND "status" = 10
         AND "expires_at" IS NOT NULL
         AND "expires_at" > CURRENT_TIMESTAMP;
      GET DIAGNOSTICS changed = ROW_COUNT;
      IF changed <> 1 THEN
        RAISE EXCEPTION 'user avatar upload is not claimable'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    -- Removal, empty value, or an unchanged historical external URL: nothing
    -- of this account may stay attached.
    UPDATE "media_file"
       SET "status" = 30,
           "delete_started_at" = CURRENT_TIMESTAMP,
           "expires_at" = CURRENT_TIMESTAMP,
           "updated_at" = CURRENT_TIMESTAMP
     WHERE "uploader_id" = NEW."id"
       AND "purpose" = 'user-avatar'
       AND "status" = 20;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "user_avatar_media_insert"
  AFTER INSERT ON "user"
  FOR EACH ROW EXECUTE FUNCTION "media_file_sync_user_avatar"();

CREATE TRIGGER "user_avatar_media_update"
  BEFORE UPDATE OF "image" ON "user"
  FOR EACH ROW EXECUTE FUNCTION "media_file_sync_user_avatar"();

CREATE TRIGGER "user_avatar_media_release"
  BEFORE DELETE ON "user"
  FOR EACH ROW EXECUTE FUNCTION "media_file_sync_user_avatar"();

COMMIT;
