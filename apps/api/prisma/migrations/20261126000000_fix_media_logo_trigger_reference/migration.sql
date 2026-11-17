-- Forward fix for the organization logo trigger.
--
-- `20261125000000_media_files` was applied to the local database through
-- `bun run db:deploy`; its function declared a PL/pgSQL variable named
-- `reference`, which collided with the `media_file.reference` column in
-- `SET "reference" = reference` and raised PostgreSQL error 42702 (ambiguous
-- column reference) on any logo-bearing native organization update.
--
-- This migration replaces only the function body: the variable is renamed to
-- `logo_reference` everywhere it is used, and the quoted column name
-- `"reference"` is unchanged. No trigger is dropped or recreated, no table,
-- row, column, index, or constraint is touched, and timing/binding/deletion
-- behavior is identical. Postgres resolves every unqualified identifier here
-- without a column/variable collision.
--
-- The applied migration file is intentionally left untouched; Prisma tracks
-- its checksum. Prisma does not wrap a PostgreSQL migration in a transaction,
-- so this file is one explicit BEGIN/COMMIT block. It has not been executed
-- by this change.

BEGIN;

CREATE OR REPLACE FUNCTION "media_file_sync_organization_logo"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  logo_reference text;
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

  logo_reference := NEW."logo";

  IF logo_reference IS NOT NULL
     AND logo_reference <> ''
     AND logo_reference !~ '^/media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
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

  IF logo_reference IS NOT NULL
     AND logo_reference ~ '^/media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    media_uuid := substr(logo_reference, 8)::uuid;

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
             "reference" = logo_reference,
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

COMMIT;
