-- Native Better Auth organization cutover.
-- One transaction. Existing rows move into the inserted organization.
-- organization_id has no default, so later writes cannot fall into that org.
-- Numeric business and Owner ids stay. Auth user, account, and password rows stay.
-- Group becomes Team id team_<id> with display name preserved.
-- Each group becomes dynamic role legacy_group_<numeric id>, stored lowercase.
-- Rows named owner, admin, or member are not created. Native organization admin
-- is not an organization_role and receives no ERP scopes. A group's old admin
-- business scope is stored only on that legacy role as erp_settings.
-- Grants are expanded once (add or delete implies change; change implies view).
-- A global user.role token admin, or isSuperuser, becomes Member.role owner.
-- Every other user is member plus their legacy role keys.
-- Invitation is created empty. Nothing in this migration sends mail.
-- user_profile.primary_team_id is copied only when user_group contains that
-- user and group. A primary group without membership stays empty. Session
-- activeTeamId is copied only when that team membership exists.
-- Owner, project, location, part, stock, purchase, and build owner links are
-- RESTRICT. Nullable SetNull links keep their single-column action. A deferred
-- same-org foreign key rejects a cross-org target without nulling organization_id.
-- address_one_primary_per_company and stock_item_unique_part_serial stay as they
-- are: parent ids are global and the same-org foreign keys bind the parent.

BEGIN;

CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "member_userId_idx" ON "member"("userId");
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_organizationId_id_key" ON "team"("organizationId", "id");

CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipKey" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_member_membershipKey_key" ON "team_member"("membershipKey");
CREATE INDEX "team_member_userId_idx" ON "team_member"("userId");
CREATE UNIQUE INDEX "team_member_teamId_userId_key" ON "team_member"("teamId", "userId");

CREATE TABLE "organization_role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    CONSTRAINT "organization_role_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "organization_role_role_idx" ON "organization_role"("role");
CREATE UNIQUE INDEX "organization_role_organizationId_role_key" ON "organization_role"("organizationId", "role");

CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "teamId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,
    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");
CREATE INDEX "invitation_email_idx" ON "invitation"("email");
CREATE INDEX "invitation_teamId_idx" ON "invitation"("teamId");
CREATE INDEX "invitation_inviterId_idx" ON "invitation"("inviterId");

ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "team" ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "organization_role" ADD CONSTRAINT "organization_role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

LOCK TABLE "address", "attachment", "bom_item", "bom_item_substitute", "build", "build_item", "build_line", "company", "contact", "custom_status", "custom_unit", "group", "manufacturer_part", "note", "notes_image", "notification_entry", "notification_message", "owner", "parameter", "parameter_template", "part", "part_category", "part_category_parameter_template", "part_internal_price_break", "part_sell_price_break", "part_test_template", "project_code", "purchase_order", "purchase_order_extra_line", "purchase_order_line_item", "rule_set", "selection_list", "selection_list_entry", "session", "stock_item", "stock_item_test_result", "stock_item_tracking", "stock_location", "stock_location_type", "supplier_part", "supplier_price_break", "system_setting", "tag", "tagged_item", "user", "user_group", "user_profile", "user_setting", "webhook_endpoint", "webhook_message" IN ACCESS EXCLUSIVE MODE;

INSERT INTO "organization" ("id", "name", "slug", "createdAt")
VALUES (gen_random_uuid()::text, 'Initial', 'initial', CURRENT_TIMESTAMP);

INSERT INTO "team" ("id", "name", "memberCount", "organizationId", "createdAt")
SELECT 'team_' || "group"."id"::text, "group"."name", 0, "organization"."id", CURRENT_TIMESTAMP
FROM "group"
CROSS JOIN "organization"
WHERE "organization"."slug" = 'initial';

INSERT INTO "organization_role" ("id", "organizationId", "role", "permission", "createdAt")
SELECT
    gen_random_uuid()::text,
    "organization"."id",
    lower('legacy_group_' || "group"."id"::text),
    perm.permission,
    CURRENT_TIMESTAMP
FROM "group"
CROSS JOIN "organization"
CROSS JOIN LATERAL (
    SELECT COALESCE((
        SELECT jsonb_object_agg(mapped.scope, mapped.actions)
        FROM (
            SELECT
                CASE WHEN rule_set.name = 'admin' THEN 'erp_settings' ELSE rule_set.name END AS scope,
                (
                    SELECT jsonb_agg(action ORDER BY ord)
                    FROM (
                        SELECT 'view' AS action, 1 AS ord
                        WHERE rule_set.can_view OR rule_set.can_add OR rule_set.can_change OR rule_set.can_delete
                        UNION ALL
                        SELECT 'add', 2 WHERE rule_set.can_add
                        UNION ALL
                        SELECT 'change', 3 WHERE rule_set.can_change OR rule_set.can_add OR rule_set.can_delete
                        UNION ALL
                        SELECT 'delete', 4 WHERE rule_set.can_delete
                    ) AS acts
                ) AS actions
            FROM "rule_set"
            WHERE rule_set.group_id = "group"."id"
        ) AS mapped
        WHERE mapped.actions IS NOT NULL
    ), '{}'::jsonb)::text AS permission
) AS perm
WHERE "organization"."slug" = 'initial'
  AND lower('legacy_group_' || "group"."id"::text) NOT IN ('owner', 'admin', 'member');

DELETE FROM "organization_role"
WHERE lower("role") IN ('owner', 'admin', 'member');

INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
SELECT
    gen_random_uuid()::text,
    "organization"."id",
    "user"."id",
    CASE
        WHEN legacy.roles IS NULL THEN base.role
        ELSE base.role || ',' || legacy.roles
    END,
    CURRENT_TIMESTAMP
FROM "user"
CROSS JOIN "organization"
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN COALESCE("user"."isSuperuser", false)
            OR EXISTS (
                SELECT 1
                FROM unnest(string_to_array(COALESCE("user"."role", ''), ',')) AS token
                WHERE btrim(token) = 'admin'
            )
        THEN 'owner'
        ELSE 'member'
    END AS role
) AS base
LEFT JOIN LATERAL (
    SELECT string_agg(lower('legacy_group_' || user_group.group_id::text), ',' ORDER BY user_group.group_id) AS roles
    FROM "user_group"
    WHERE user_group.user_id = "user"."id"
) AS legacy ON true
WHERE "organization"."slug" = 'initial';

INSERT INTO "team_member" ("id", "teamId", "userId", "createdAt")
SELECT gen_random_uuid()::text, 'team_' || user_group.group_id::text, user_group.user_id, CURRENT_TIMESTAMP
FROM "user_group";

UPDATE "team"
SET "memberCount" = counted.members
FROM (
    SELECT "teamId", COUNT(*)::integer AS members
    FROM "team_member"
    GROUP BY "teamId"
) AS counted
WHERE "team"."id" = counted."teamId";

DROP TRIGGER IF EXISTS "stock_item_access_before_write" ON "stock_item";
DROP TRIGGER IF EXISTS "stock_item_retain_history" ON "stock_item";
DROP TRIGGER IF EXISTS "owner_refresh_stock_access" ON "owner";
DROP FUNCTION IF EXISTS "stock_item_access_before_write"();
DROP FUNCTION IF EXISTS "stock_item_retain_history"();
DROP FUNCTION IF EXISTS "owner_refresh_stock_access"();

DO $$
DECLARE
    org text;
    tbl text;
    tables text[] := ARRAY[
        'owner', 'system_setting', 'user_setting', 'custom_unit', 'custom_status',
        'project_code', 'user_profile', 'company', 'contact', 'address',
        'stock_location_type', 'stock_location', 'part_category', 'parameter_template',
        'part_category_parameter_template', 'part', 'parameter', 'manufacturer_part',
        'supplier_part', 'supplier_price_break', 'bom_item', 'bom_item_substitute',
        'part_sell_price_break', 'part_internal_price_break', 'stock_item',
        'stock_item_tracking', 'part_test_template', 'stock_item_test_result',
        'purchase_order', 'purchase_order_line_item', 'purchase_order_extra_line',
        'build', 'build_line', 'build_item',
        'tag', 'tagged_item', 'selection_list', 'selection_list_entry', 'note',
        'notes_image', 'attachment', 'notification_entry', 'notification_message',
        'webhook_endpoint', 'webhook_message'
    ];
BEGIN
    SELECT id INTO org FROM "organization" WHERE slug = 'initial';
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id TEXT', tbl);
        EXECUTE format('UPDATE %I SET organization_id = $1', tbl) USING org;
        EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', tbl);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE RESTRICT ON UPDATE NO ACTION',
            tbl, tbl || '_organization_id_fkey'
        );
        EXECUTE format(
            'CREATE UNIQUE INDEX %I ON %I (organization_id, id)',
            tbl || '_organization_id_id_key', tbl
        );
    END LOOP;
END $$;

ALTER TABLE "owner" ADD COLUMN "team_id" TEXT;
UPDATE "owner" SET "team_id" = 'team_' || "group_id"::text WHERE "group_id" IS NOT NULL;
ALTER TABLE "owner" DROP CONSTRAINT "owner_exactly_one_target";
ALTER TABLE "owner" DROP CONSTRAINT "owner_group_id_fkey";
DROP INDEX "owner_group_id_key";
DROP INDEX "owner_user_id_key";
ALTER TABLE "owner" DROP COLUMN "group_id";
ALTER TABLE "owner" ADD CONSTRAINT "owner_exactly_one_target" CHECK (num_nonnulls("user_id", "team_id") = 1);
ALTER TABLE "owner" DROP CONSTRAINT "owner_user_id_fkey";
ALTER TABLE "owner" ADD CONSTRAINT "owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE INDEX "owner_user_id_idx" ON "owner"("user_id");
CREATE INDEX "owner_team_id_idx" ON "owner"("team_id");
CREATE UNIQUE INDEX "owner_organization_id_user_id_key" ON "owner"("organization_id", "user_id");
CREATE UNIQUE INDEX "owner_organization_id_team_id_key" ON "owner"("organization_id", "team_id");
ALTER TABLE "owner" ADD CONSTRAINT "owner_organization_id_team_id_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "team"("organizationId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "user_profile" ADD COLUMN "primary_team_id" TEXT;
UPDATE "user_profile"
SET "primary_team_id" = 'team_' || "user_profile"."primary_group_id"::text
WHERE "primary_group_id" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "user_group"
    WHERE "user_group"."user_id" = "user_profile"."user_id"
      AND "user_group"."group_id" = "user_profile"."primary_group_id"
  );
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_primary_team_id_user_id_fkey" FOREIGN KEY ("primary_team_id", "user_id") REFERENCES "team_member"("teamId", "userId") ON DELETE SET NULL ("primary_team_id") ON UPDATE NO ACTION;
ALTER TABLE "user_profile" DROP CONSTRAINT "user_profile_primary_group_id_fkey";
DROP INDEX "user_profile_primary_group_id_idx";
ALTER TABLE "user_profile" DROP COLUMN "primary_group_id";
DROP INDEX "user_profile_user_id_key";
CREATE UNIQUE INDEX "user_profile_organization_id_user_id_key" ON "user_profile"("organization_id", "user_id");
CREATE INDEX "user_profile_primary_team_id_idx" ON "user_profile"("primary_team_id");
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_primary_team_id_fkey" FOREIGN KEY ("primary_team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "session" ADD COLUMN "activeOrganizationId" TEXT;
ALTER TABLE "session" ADD COLUMN "activeTeamId" TEXT;
UPDATE "session"
SET "activeOrganizationId" = "organization"."id"
FROM "organization"
WHERE "organization"."slug" = 'initial';
UPDATE "session"
SET "activeTeamId" = "user_profile"."primary_team_id"
FROM "user_profile"
JOIN "team_member"
    ON "team_member"."userId" = "user_profile"."user_id"
   AND "team_member"."teamId" = "user_profile"."primary_team_id"
WHERE "session"."userId" = "user_profile"."user_id"
  AND "user_profile"."primary_team_id" IS NOT NULL;
CREATE INDEX "session_activeOrganizationId_idx" ON "session"("activeOrganizationId");
CREATE INDEX "session_activeTeamId_idx" ON "session"("activeTeamId");
ALTER TABLE "session" ADD CONSTRAINT "session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "session" ADD CONSTRAINT "session_activeTeamId_fkey" FOREIGN KEY ("activeTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "session" ADD CONSTRAINT "session_active_team_requires_org" CHECK ("activeTeamId" IS NULL OR "activeOrganizationId" IS NOT NULL);

ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_access_open_identity_check";
ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_access_group_id_fkey";
DROP INDEX "stock_item_access_group_id_idx";
ALTER TABLE "stock_item" ADD COLUMN "access_team_id" TEXT;
UPDATE "stock_item" SET "access_team_id" = 'team_' || "access_group_id"::text WHERE "access_group_id" IS NOT NULL;
ALTER TABLE "stock_item" DROP COLUMN "access_group_id";
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_access_open_identity_check" CHECK ("access_open" = false OR ("access_user_id" IS NULL AND "access_team_id" IS NULL));
CREATE INDEX "stock_item_access_team_id_idx" ON "stock_item"("access_team_id");
ALTER TABLE "stock_item" DROP CONSTRAINT "stock_item_access_user_id_fkey";
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_access_user_id_fkey" FOREIGN KEY ("access_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "stock_item_tracking" DROP CONSTRAINT "stock_item_tracking_access_open_identity_check";
ALTER TABLE "stock_item_tracking" DROP CONSTRAINT "stock_item_tracking_access_group_id_fkey";
DROP INDEX "stock_item_tracking_access_group_id_idx";
ALTER TABLE "stock_item_tracking" ADD COLUMN "access_team_id" TEXT;
UPDATE "stock_item_tracking" SET "access_team_id" = 'team_' || "access_group_id"::text WHERE "access_group_id" IS NOT NULL;
ALTER TABLE "stock_item_tracking" DROP COLUMN "access_group_id";
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_access_open_identity_check" CHECK ("access_open" = false OR ("access_user_id" IS NULL AND "access_team_id" IS NULL));
CREATE INDEX "stock_item_tracking_access_team_id_idx" ON "stock_item_tracking"("access_team_id");
ALTER TABLE "stock_item_tracking" DROP CONSTRAINT "stock_item_tracking_access_user_id_fkey";
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_access_user_id_fkey" FOREIGN KEY ("access_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "user_profile" DROP CONSTRAINT "user_profile_organization_id_fkey";
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "user_setting" DROP CONSTRAINT "user_setting_organization_id_fkey";
ALTER TABLE "user_setting" ADD CONSTRAINT "user_setting_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

DROP INDEX "system_setting_key_key";
CREATE UNIQUE INDEX "system_setting_organization_id_key_key" ON "system_setting"("organization_id", "key");
DROP INDEX "user_setting_key_user_id_key";
CREATE UNIQUE INDEX "user_setting_organization_id_key_user_id_key" ON "user_setting"("organization_id", "key", "user_id");
DROP INDEX "custom_unit_name_key";
CREATE UNIQUE INDEX "custom_unit_organization_id_name_key" ON "custom_unit"("organization_id", "name");
DROP INDEX "custom_status_reference_status_key_key";
CREATE UNIQUE INDEX "custom_status_organization_id_reference_status_key_key" ON "custom_status"("organization_id", "reference_status", "key");
DROP INDEX "custom_status_reference_status_name_key";
CREATE UNIQUE INDEX "custom_status_organization_id_reference_status_name_key" ON "custom_status"("organization_id", "reference_status", "name");
DROP INDEX "project_code_code_key";
CREATE UNIQUE INDEX "project_code_organization_id_code_key" ON "project_code"("organization_id", "code");
ALTER TABLE "parameter_template" DROP CONSTRAINT "parameter_template_name_key";
CREATE UNIQUE INDEX "parameter_template_organization_id_name_key" ON "parameter_template"("organization_id", "name");
ALTER TABLE "part" DROP CONSTRAINT "part_name_ipn_revision_key";
CREATE UNIQUE INDEX "part_organization_id_name_ipn_revision_key" ON "part"("organization_id", "name", "ipn", "revision");
DROP INDEX "purchase_order_reference_key";
CREATE UNIQUE INDEX "purchase_order_organization_id_reference_key" ON "purchase_order"("organization_id", "reference");
DROP INDEX "build_reference_key";
CREATE UNIQUE INDEX "build_organization_id_reference_key" ON "build"("organization_id", "reference");

DROP INDEX "tag_name_key";
DROP INDEX "tag_slug_key";
DROP INDEX "tag_name_lower_key";
DROP INDEX "tag_slug_lower_key";
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("organization_id", "name");
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("organization_id", "slug");
CREATE UNIQUE INDEX "tag_name_lower_key" ON "tag"("organization_id", lower("name"));
CREATE UNIQUE INDEX "tag_slug_lower_key" ON "tag"("organization_id", lower("slug"));
DROP INDEX "selection_list_name_key";
CREATE UNIQUE INDEX "selection_list_name_key" ON "selection_list"("organization_id", "name");
DROP INDEX "notification_entry_key_uid_key";
CREATE UNIQUE INDEX "notification_entry_key_uid_key" ON "notification_entry"("organization_id", "key", "uid");
DROP INDEX "unique_primary_note_per_model";
CREATE UNIQUE INDEX "unique_primary_note_per_model" ON "note"("organization_id", "model_type_id", "model_id") WHERE "primary" = TRUE AND "template" = FALSE;

DO $$
DECLARE
    item text;
    old_keys text[] := ARRAY[
        'contact.contact_company_id_fkey',
        'address.address_company_id_fkey',
        'stock_location.stock_location_parent_id_fkey',
        'stock_location.stock_location_owner_id_fkey',
        'part_category.part_category_parent_id_fkey',
        'part_category_parameter_template.part_category_parameter_template_category_id_fkey',
        'part_category_parameter_template.part_category_parameter_template_template_id_fkey',
        'part.part_category_id_fkey',
        'part.part_responsible_owner_id_fkey',
        'parameter.parameter_template_id_fkey',
        'manufacturer_part.manufacturer_part_part_id_fkey',
        'manufacturer_part.manufacturer_part_manufacturer_id_fkey',
        'supplier_part.supplier_part_part_id_fkey',
        'supplier_part.supplier_part_supplier_id_fkey',
        'supplier_part.supplier_part_manufacturer_part_id_fkey',
        'supplier_price_break.supplier_price_break_part_id_fkey',
        'bom_item.bom_item_part_id_fkey',
        'bom_item.bom_item_sub_part_id_fkey',
        'bom_item_substitute.bom_item_substitute_bom_item_id_fkey',
        'bom_item_substitute.bom_item_substitute_part_id_fkey',
        'part_sell_price_break.part_sell_price_break_part_id_fkey',
        'part_internal_price_break.part_internal_price_break_part_id_fkey',
        'stock_item.stock_item_belongs_to_id_fkey',
        'stock_item.stock_item_part_id_fkey',
        'stock_item.stock_item_location_id_fkey',
        'stock_item.stock_item_owner_id_fkey',
        'stock_item.stock_item_consumed_by_id_fkey',
        'stock_item_tracking.stock_item_tracking_part_id_fkey',
        'part_test_template.part_test_template_part_id_fkey',
        'stock_item_test_result.stock_item_test_result_stock_item_id_fkey',
        'stock_item_test_result.stock_item_test_result_template_id_fkey',
        'project_code.project_code_responsible_id_fkey',
        'purchase_order.purchase_order_responsible_id_fkey',
        'purchase_order_line_item.purchase_order_line_item_order_id_fkey',
        'purchase_order_extra_line.purchase_order_extra_line_order_id_fkey',
        'build.build_part_id_fkey',
        'build.build_responsible_id_fkey',
        'build_line.build_line_build_id_fkey',
        'build_line.build_line_bom_item_id_fkey',
        'build_item.build_item_build_line_id_fkey',
        'build_item.build_item_stock_item_id_fkey',
        'build_item.build_item_install_into_id_fkey',
        'tagged_item.tagged_item_tag_id_fkey',
        'selection_list_entry.selection_list_entry_list_id_fkey',
        'notes_image.notes_image_note_id_fkey',
        'parameter_template.parameter_template_selectionlist_id_fkey'
    ];
BEGIN
    FOREACH item IN ARRAY old_keys LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT %I',
            split_part(item, '.', 1),
            split_part(item, '.', 2)
        );
    END LOOP;
END $$;

ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "company"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "address" ADD CONSTRAINT "address_organization_id_company_id_fkey" FOREIGN KEY ("organization_id", "company_id") REFERENCES "company"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_location" ADD CONSTRAINT "stock_location_organization_id_parent_id_fkey" FOREIGN KEY ("organization_id", "parent_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "stock_location" ADD CONSTRAINT "stock_location_organization_id_owner_id_fkey" FOREIGN KEY ("organization_id", "owner_id") REFERENCES "owner"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "part_category" ADD CONSTRAINT "part_category_organization_id_parent_id_fkey" FOREIGN KEY ("organization_id", "parent_id") REFERENCES "part_category"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "part_category_parameter_template" ADD CONSTRAINT "part_category_parameter_template_organization_id_category__fkey" FOREIGN KEY ("organization_id", "category_id") REFERENCES "part_category"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "part_category_parameter_template" ADD CONSTRAINT "part_category_parameter_template_organization_id_template__fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "parameter_template"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "part" ADD CONSTRAINT "part_organization_id_category_id_fkey" FOREIGN KEY ("organization_id", "category_id") REFERENCES "part_category"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "part" ADD CONSTRAINT "part_organization_id_responsible_owner_id_fkey" FOREIGN KEY ("organization_id", "responsible_owner_id") REFERENCES "owner"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "parameter" ADD CONSTRAINT "parameter_organization_id_template_id_fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "parameter_template"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "manufacturer_part" ADD CONSTRAINT "manufacturer_part_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "manufacturer_part" ADD CONSTRAINT "manufacturer_part_organization_id_manufacturer_id_fkey" FOREIGN KEY ("organization_id", "manufacturer_id") REFERENCES "company"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "supplier_part" ADD CONSTRAINT "supplier_part_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "supplier_part" ADD CONSTRAINT "supplier_part_organization_id_supplier_id_fkey" FOREIGN KEY ("organization_id", "supplier_id") REFERENCES "company"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "supplier_part" ADD CONSTRAINT "supplier_part_organization_id_manufacturer_part_id_fkey" FOREIGN KEY ("organization_id", "manufacturer_part_id") REFERENCES "manufacturer_part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "supplier_price_break" ADD CONSTRAINT "supplier_price_break_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "supplier_part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bom_item" ADD CONSTRAINT "bom_item_organization_id_sub_part_id_fkey" FOREIGN KEY ("organization_id", "sub_part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bom_item_substitute" ADD CONSTRAINT "bom_item_substitute_organization_id_bom_item_id_fkey" FOREIGN KEY ("organization_id", "bom_item_id") REFERENCES "bom_item"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bom_item_substitute" ADD CONSTRAINT "bom_item_substitute_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "part_sell_price_break" ADD CONSTRAINT "part_sell_price_break_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "part_internal_price_break" ADD CONSTRAINT "part_internal_price_break_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_belongs_to_id_fkey" FOREIGN KEY ("organization_id", "belongs_to_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_location_id_fkey" FOREIGN KEY ("organization_id", "location_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_owner_id_fkey" FOREIGN KEY ("organization_id", "owner_id") REFERENCES "owner"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_access_team_id_fkey" FOREIGN KEY ("organization_id", "access_team_id") REFERENCES "team"("organizationId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_consumed_by_id_fkey" FOREIGN KEY ("organization_id", "consumed_by_id") REFERENCES "build"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_organization_id_access_team_id_fkey" FOREIGN KEY ("organization_id", "access_team_id") REFERENCES "team"("organizationId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "part_test_template" ADD CONSTRAINT "part_test_template_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_test_result" ADD CONSTRAINT "stock_item_test_result_organization_id_stock_item_id_fkey" FOREIGN KEY ("organization_id", "stock_item_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_item_test_result" ADD CONSTRAINT "stock_item_test_result_organization_id_template_id_fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "part_test_template"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "project_code" ADD CONSTRAINT "project_code_organization_id_responsible_id_fkey" FOREIGN KEY ("organization_id", "responsible_id") REFERENCES "owner"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_organization_id_responsible_id_fkey" FOREIGN KEY ("organization_id", "responsible_id") REFERENCES "owner"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_organization_id_order_id_fkey" FOREIGN KEY ("organization_id", "order_id") REFERENCES "purchase_order"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_extra_line" ADD CONSTRAINT "purchase_order_extra_line_organization_id_order_id_fkey" FOREIGN KEY ("organization_id", "order_id") REFERENCES "purchase_order"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_organization_id_part_id_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "part"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build" ADD CONSTRAINT "build_organization_id_responsible_id_fkey" FOREIGN KEY ("organization_id", "responsible_id") REFERENCES "owner"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_line" ADD CONSTRAINT "build_line_organization_id_build_id_fkey" FOREIGN KEY ("organization_id", "build_id") REFERENCES "build"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_line" ADD CONSTRAINT "build_line_organization_id_bom_item_id_fkey" FOREIGN KEY ("organization_id", "bom_item_id") REFERENCES "bom_item"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_organization_id_build_line_id_fkey" FOREIGN KEY ("organization_id", "build_line_id") REFERENCES "build_line"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_organization_id_stock_item_id_fkey" FOREIGN KEY ("organization_id", "stock_item_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_organization_id_install_into_id_fkey" FOREIGN KEY ("organization_id", "install_into_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "tagged_item" ADD CONSTRAINT "tagged_item_organization_id_tag_id_fkey" FOREIGN KEY ("organization_id", "tag_id") REFERENCES "tag"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "selection_list_entry" ADD CONSTRAINT "selection_list_entry_organization_id_list_id_fkey" FOREIGN KEY ("organization_id", "list_id") REFERENCES "selection_list"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "parameter_template" ADD CONSTRAINT "parameter_template_organization_id_selectionlist_id_fkey" FOREIGN KEY ("organization_id", "selectionlist_id") REFERENCES "selection_list"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "notes_image" ADD CONSTRAINT "notes_image_organization_id_note_id_fkey" FOREIGN KEY ("organization_id", "note_id") REFERENCES "note"("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- SetNull stays on the single-column foreign key. The same-org key is deferred
-- so that action can null the parent id before the composite is checked.
ALTER TABLE "part" ADD CONSTRAINT "part_variant_of_id_same_org_fkey" FOREIGN KEY ("organization_id", "variant_of_id") REFERENCES "part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "part" ADD CONSTRAINT "part_revision_of_id_same_org_fkey" FOREIGN KEY ("organization_id", "revision_of_id") REFERENCES "part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "part" ADD CONSTRAINT "part_default_location_id_same_org_fkey" FOREIGN KEY ("organization_id", "default_location_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_location" ADD CONSTRAINT "stock_location_location_type_id_same_org_fkey" FOREIGN KEY ("organization_id", "location_type_id") REFERENCES "stock_location_type"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "part_category" ADD CONSTRAINT "part_category_default_location_id_same_org_fkey" FOREIGN KEY ("organization_id", "default_location_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_parent_id_same_org_fkey" FOREIGN KEY ("organization_id", "parent_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_supplier_part_id_same_org_fkey" FOREIGN KEY ("organization_id", "supplier_part_id") REFERENCES "supplier_part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_customer_id_same_org_fkey" FOREIGN KEY ("organization_id", "customer_id") REFERENCES "company"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_purchase_order_id_same_org_fkey" FOREIGN KEY ("organization_id", "purchase_order_id") REFERENCES "purchase_order"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_build_id_same_org_fkey" FOREIGN KEY ("organization_id", "build_id") REFERENCES "build"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "stock_item_tracking" ADD CONSTRAINT "stock_item_tracking_item_id_same_org_fkey" FOREIGN KEY ("organization_id", "item_id") REFERENCES "stock_item"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_project_code_id_same_org_fkey" FOREIGN KEY ("organization_id", "project_code_id") REFERENCES "project_code"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_contact_id_same_org_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contact"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_address_id_same_org_fkey" FOREIGN KEY ("organization_id", "address_id") REFERENCES "address"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_same_org_fkey" FOREIGN KEY ("organization_id", "supplier_id") REFERENCES "company"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_destination_id_same_org_fkey" FOREIGN KEY ("organization_id", "destination_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_project_code_id_same_org_fkey" FOREIGN KEY ("organization_id", "project_code_id") REFERENCES "project_code"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_part_id_same_org_fkey" FOREIGN KEY ("organization_id", "part_id") REFERENCES "supplier_part"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order_line_item" ADD CONSTRAINT "purchase_order_line_item_destination_id_same_org_fkey" FOREIGN KEY ("organization_id", "destination_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "purchase_order_extra_line" ADD CONSTRAINT "purchase_order_extra_line_project_code_id_same_org_fkey" FOREIGN KEY ("organization_id", "project_code_id") REFERENCES "project_code"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build" ADD CONSTRAINT "build_parent_id_same_org_fkey" FOREIGN KEY ("organization_id", "parent_id") REFERENCES "build"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build" ADD CONSTRAINT "build_take_from_id_same_org_fkey" FOREIGN KEY ("organization_id", "take_from_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build" ADD CONSTRAINT "build_destination_id_same_org_fkey" FOREIGN KEY ("organization_id", "destination_id") REFERENCES "stock_location"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "build" ADD CONSTRAINT "build_project_code_id_same_org_fkey" FOREIGN KEY ("organization_id", "project_code_id") REFERENCES "project_code"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_primary_team_id_same_org_fkey" FOREIGN KEY ("organization_id", "primary_team_id") REFERENCES "team"("organizationId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "session" ADD CONSTRAINT "session_activeTeamId_same_org_fkey" FOREIGN KEY ("activeOrganizationId", "activeTeamId") REFERENCES "team"("organizationId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_teamId_same_org_fkey" FOREIGN KEY ("organizationId", "teamId") REFERENCES "team"("organizationId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "selection_list" ADD CONSTRAINT "selection_list_default_id_same_org_fkey" FOREIGN KEY ("organization_id", "default_id") REFERENCES "selection_list_entry"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "webhook_message" ADD CONSTRAINT "webhook_message_endpoint_id_same_org_fkey" FOREIGN KEY ("organization_id", "endpoint_id") REFERENCES "webhook_endpoint"("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION "stock_item_access_before_write"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    owner_user TEXT;
    owner_team TEXT;
BEGIN
    IF TG_OP = 'INSERT' AND NEW."owner_id" IS NOT NULL THEN
        SELECT owner."user_id", owner."team_id"
        INTO owner_user, owner_team
        FROM "owner" AS owner
        WHERE owner."id" = NEW."owner_id"
          AND owner."organization_id" = NEW."organization_id";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'stock owner % is not in organization %', NEW."owner_id", NEW."organization_id";
        END IF;
        NEW."access_user_id" := owner_user;
        NEW."access_team_id" := owner_team;
        NEW."access_open" := false;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW."owner_id" IS NOT NULL
       AND NEW."owner_id" IS DISTINCT FROM OLD."owner_id" THEN
        SELECT owner."user_id", owner."team_id"
        INTO owner_user, owner_team
        FROM "owner" AS owner
        WHERE owner."id" = NEW."owner_id"
          AND owner."organization_id" = NEW."organization_id";
        IF NOT FOUND THEN
            RAISE EXCEPTION 'stock owner % is not in organization %', NEW."owner_id", NEW."organization_id";
        END IF;
        NEW."access_user_id" := owner_user;
        NEW."access_team_id" := owner_team;
        NEW."access_open" := false;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD."owner_id" IS NOT NULL
       AND NEW."owner_id" IS NULL
       AND NEW."access_open" IS TRUE
       AND OLD."access_open" IS DISTINCT FROM TRUE THEN
        NEW."access_user_id" := NULL;
        NEW."access_team_id" := NULL;
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
        NEW."access_team_id" := OLD."access_team_id";
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' AND NEW."owner_id" IS NULL THEN
        IF NEW."access_user_id" IS NOT NULL OR NEW."access_team_id" IS NOT NULL THEN
            NEW."access_open" := false;
        ELSIF NEW."access_open" IS TRUE THEN
            NEW."access_user_id" := NULL;
            NEW."access_team_id" := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "stock_item_access_before_write"
BEFORE INSERT OR UPDATE ON "stock_item"
FOR EACH ROW
EXECUTE FUNCTION "stock_item_access_before_write"();

CREATE FUNCTION "stock_item_retain_history"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE "stock_item_tracking"
    SET
        "access_open" = OLD."access_open",
        "access_user_id" = OLD."access_user_id",
        "access_team_id" = OLD."access_team_id"
    WHERE "item_id" = OLD."id"
      AND "organization_id" = OLD."organization_id";
    RETURN OLD;
END;
$$;

CREATE TRIGGER "stock_item_retain_history"
BEFORE DELETE ON "stock_item"
FOR EACH ROW
EXECUTE FUNCTION "stock_item_retain_history"();

CREATE FUNCTION "owner_refresh_stock_access"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"
       AND NEW."team_id" IS NOT DISTINCT FROM OLD."team_id"
       AND NEW."organization_id" IS NOT DISTINCT FROM OLD."organization_id" THEN
        RETURN NEW;
    END IF;
    UPDATE "stock_item"
    SET
        "access_user_id" = NEW."user_id",
        "access_team_id" = NEW."team_id",
        "access_open" = false
    WHERE "owner_id" = NEW."id"
      AND "organization_id" = NEW."organization_id";
    RETURN NEW;
END;
$$;

CREATE TRIGGER "owner_refresh_stock_access"
AFTER UPDATE OF "user_id", "team_id", "organization_id" ON "owner"
FOR EACH ROW
EXECUTE FUNCTION "owner_refresh_stock_access"();

DROP TABLE "rule_set";
DROP TABLE "user_group";
DROP TABLE "group";

COMMIT;
