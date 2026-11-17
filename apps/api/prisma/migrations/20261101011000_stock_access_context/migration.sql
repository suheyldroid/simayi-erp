-- Stock visibility context that survives Owner deletion.
-- access_open true: the owner was explicitly cleared; stock.view is enough.
-- access_open false with a user or group: last owner identity, including after
-- owner_id is set null by a foreign key. A later user/group SetNull leaves the
-- row closed. It does not become access_open.
-- Tracking rows with item_id already null are left closed. Their last owner
-- cannot be proved, so this migration does not guess.

ALTER TABLE "stock_item" ADD COLUMN "access_open" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stock_item" ADD COLUMN "access_user_id" TEXT;
ALTER TABLE "stock_item" ADD COLUMN "access_group_id" INTEGER;

ALTER TABLE "stock_item_tracking" ADD COLUMN "access_open" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stock_item_tracking" ADD COLUMN "access_user_id" TEXT;
ALTER TABLE "stock_item_tracking" ADD COLUMN "access_group_id" INTEGER;

UPDATE "stock_item" AS stock
SET
    "access_user_id" = owner."user_id",
    "access_group_id" = owner."group_id",
    "access_open" = false
FROM "owner" AS owner
WHERE stock."owner_id" = owner."id";

UPDATE "stock_item"
SET
    "access_open" = true,
    "access_user_id" = NULL,
    "access_group_id" = NULL
WHERE "owner_id" IS NULL;

ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_access_user_id_fkey" FOREIGN KEY ("access_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_access_user_id_fkey" FOREIGN KEY ("access_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "stock_item_access_open_idx" ON "stock_item"("access_open");
CREATE INDEX "stock_item_access_user_id_idx" ON "stock_item"("access_user_id");
CREATE INDEX "stock_item_access_group_id_idx" ON "stock_item"("access_group_id");
CREATE INDEX "stock_item_tracking_access_open_idx" ON "stock_item_tracking"("access_open");
CREATE INDEX "stock_item_tracking_access_user_id_idx" ON "stock_item_tracking"("access_user_id");
CREATE INDEX "stock_item_tracking_access_group_id_idx" ON "stock_item_tracking"("access_group_id");

ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_access_open_identity_check" CHECK ("access_open" = false OR ("access_user_id" IS NULL AND "access_group_id" IS NULL));
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_access_open_identity_check" CHECK ("access_open" = false OR ("access_user_id" IS NULL AND "access_group_id" IS NULL));

-- Copies Owner identity only when a stock row is inserted with an owner or
-- its owner_id actually changes to another owner. An unchanged owner_id does
-- not refresh the copy, so a user/group SetNull is not written back.
--
-- User or group delete touches two foreign keys on this row. PostgreSQL may
-- apply them in either order; this function does not choose an order and was
-- not executed against a server.
-- Access SetNull first, then Owner cascade sets owner_id null: the first
-- update leaves the null copy in place, and the owner_id update does not copy
-- OLD access columns back. Owner cascade first, then access SetNull: the
-- owner_id update keeps the copy only because that statement did not clear it,
-- and the later access SetNull is left null. Either way the deleted identity
-- is not restored and access_open stays false.
-- Deleting the Owner row while the user or group still exists only clears
-- owner_id. That statement does not null the copy, so the last identity stays.
--
-- Opening (access_open true and empty identity) is only the transition from a
-- real owner_id to null in the same statement. A row whose owner_id is already
-- null and access_open is false cannot be opened by setting the flag.
-- A null-owner insert stays closed unless it sets access_open or copies a
-- retained user/group. Owner.user_id / group_id changes still use
-- owner_refresh_stock_access, which writes the copy without changing owner_id.
CREATE FUNCTION "stock_item_access_before_write"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    owner_user TEXT;
    owner_group INTEGER;
BEGIN
    IF TG_OP = 'INSERT' AND NEW."owner_id" IS NOT NULL THEN
        SELECT owner."user_id", owner."group_id"
        INTO owner_user, owner_group
        FROM "owner" AS owner
        WHERE owner."id" = NEW."owner_id";
        NEW."access_user_id" := owner_user;
        NEW."access_group_id" := owner_group;
        NEW."access_open" := false;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW."owner_id" IS NOT NULL
       AND NEW."owner_id" IS DISTINCT FROM OLD."owner_id" THEN
        SELECT owner."user_id", owner."group_id"
        INTO owner_user, owner_group
        FROM "owner" AS owner
        WHERE owner."id" = NEW."owner_id";
        NEW."access_user_id" := owner_user;
        NEW."access_group_id" := owner_group;
        NEW."access_open" := false;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD."owner_id" IS NOT NULL
       AND NEW."owner_id" IS NULL
       AND NEW."access_open" IS TRUE
       AND OLD."access_open" IS DISTINCT FROM TRUE THEN
        NEW."access_user_id" := NULL;
        NEW."access_group_id" := NULL;
        NEW."access_open" := true;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD."owner_id" IS NOT NULL
       AND NEW."owner_id" IS NULL THEN
        NEW."access_open" := false;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD."owner_id" IS NULL
       AND OLD."access_open" IS DISTINCT FROM TRUE
       AND NEW."access_open" IS TRUE THEN
        NEW."access_open" := false;
        NEW."access_user_id" := OLD."access_user_id";
        NEW."access_group_id" := OLD."access_group_id";
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' AND NEW."owner_id" IS NULL THEN
        IF NEW."access_user_id" IS NOT NULL OR NEW."access_group_id" IS NOT NULL THEN
            NEW."access_open" := false;
        ELSIF NEW."access_open" IS TRUE THEN
            NEW."access_user_id" := NULL;
            NEW."access_group_id" := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "stock_item_access_before_write"
BEFORE INSERT OR UPDATE ON "stock_item"
FOR EACH ROW
EXECUTE FUNCTION "stock_item_access_before_write"();

-- Copies the stock row's current access onto every history row before item_id
-- is cleared. Direct deletes and foreign-key cascades both fire this trigger,
-- so the last owner is the one present at deletion, not the owner stored when
-- each history row was created.
CREATE FUNCTION "stock_item_retain_history"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE "stock_item_tracking"
    SET
        "access_open" = OLD."access_open",
        "access_user_id" = OLD."access_user_id",
        "access_group_id" = OLD."access_group_id"
    WHERE "item_id" = OLD."id";
    RETURN OLD;
END;
$$;

CREATE TRIGGER "stock_item_retain_history"
BEFORE DELETE ON "stock_item"
FOR EACH ROW
EXECUTE FUNCTION "stock_item_retain_history"();

-- Owner.user_id or group_id can change without a stock update. Refresh the
-- cache after the owner row is visible. Deleting the owner does not use this
-- path; stock.owner_id SetNull is handled above and does not open access.
CREATE FUNCTION "owner_refresh_stock_access"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"
       AND NEW."group_id" IS NOT DISTINCT FROM OLD."group_id" THEN
        RETURN NEW;
    END IF;
    UPDATE "stock_item"
    SET
        "access_user_id" = NEW."user_id",
        "access_group_id" = NEW."group_id",
        "access_open" = false
    WHERE "owner_id" = NEW."id";
    RETURN NEW;
END;
$$;

CREATE TRIGGER "owner_refresh_stock_access"
AFTER UPDATE OF "user_id", "group_id" ON "owner"
FOR EACH ROW
EXECUTE FUNCTION "owner_refresh_stock_access"();
