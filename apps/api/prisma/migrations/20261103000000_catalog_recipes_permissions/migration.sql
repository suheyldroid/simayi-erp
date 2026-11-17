-- Catalog and recipe cutover. This file is a forward migration. This document
-- does not record that it was applied. Apply it in a maintenance window after a
-- backup, with writers stopped. The script is one explicit transaction; a later
-- failure rolls the whole scope back.
--
-- Data preservation: no table is dropped or renamed.
-- parameter, parameter_template, part_category_parameter_template,
-- part_sell_price_break, part_internal_price_break, part_test_template and
-- stock_item_test_result stay physically in the public schema with all rows.
-- They are no longer mapped by prisma/schema.prisma and no route writes them.
-- Their foreign keys still reference "organization" with RESTRICT / NO ACTION,
-- so OrganizationRetention continues to block deleting an organization that
-- still holds these historical rows. Do not accept a generated Prisma diff
-- that drops these tables unless a separate archival decision is recorded.
--
-- Permission data: stored dynamic-role statements used the scope keys
-- part_category, part, and bom. The active keys are item_category, item, and
-- recipe. The JSON is rewritten in place so existing grants keep working
-- without a public API shim. If a statement contains both an old and a new key,
-- the allowed actions are merged. Keys that are not renamed are preserved
-- unchanged, including native organization, member, invitation, team, ac, and
-- ownership grants and any unknown key.
--
-- Empty scope arrays are preserved. jsonb_agg over zero rows returns NULL, so
-- each renamed scope uses COALESCE(..., '[]'::jsonb) and is emitted whenever
-- either its old or its new key exists. jsonb_strip_nulls then removes only the
-- keys that were absent. Every selected row is rebuilt even when the result is
-- an empty object.

BEGIN;

WITH current AS (
  SELECT id, permission::jsonb AS body
  FROM "organization_role"
  WHERE permission::jsonb ?| ARRAY['part', 'part_category', 'bom']
),
mapped AS (
  SELECT
    id,
    body - 'part' - 'part_category' - 'bom' AS base,
    jsonb_build_object(
      'item',
      CASE
        WHEN body ? 'item' OR body ? 'part' THEN COALESCE((
          SELECT jsonb_agg(DISTINCT action ORDER BY action)
          FROM (
            SELECT jsonb_array_elements_text(
              COALESCE(body -> 'item', '[]'::jsonb)
            ) AS action
            UNION
            SELECT jsonb_array_elements_text(
              COALESCE(body -> 'part', '[]'::jsonb)
            ) AS action
          ) AS merged_item_actions
        ), '[]'::jsonb)
      END,
      'item_category',
      CASE
        WHEN body ? 'item_category' OR body ? 'part_category' THEN COALESCE((
          SELECT jsonb_agg(DISTINCT action ORDER BY action)
          FROM (
            SELECT jsonb_array_elements_text(
              COALESCE(body -> 'item_category', '[]'::jsonb)
            ) AS action
            UNION
            SELECT jsonb_array_elements_text(
              COALESCE(body -> 'part_category', '[]'::jsonb)
            ) AS action
          ) AS merged_item_category_actions
        ), '[]'::jsonb)
      END,
      'recipe',
      CASE
        WHEN body ? 'recipe' OR body ? 'bom' THEN COALESCE((
          SELECT jsonb_agg(DISTINCT action ORDER BY action)
          FROM (
            SELECT jsonb_array_elements_text(
              COALESCE(body -> 'recipe', '[]'::jsonb)
            ) AS action
            UNION
            SELECT jsonb_array_elements_text(
              COALESCE(body -> 'bom', '[]'::jsonb)
            ) AS action
          ) AS merged_recipe_actions
        ), '[]'::jsonb)
      END
    ) AS renamed
  FROM current
),
rebuilt AS (
  SELECT
    id,
    (base || jsonb_strip_nulls(renamed))::text AS permission
  FROM mapped
)
UPDATE "organization_role" AS role
SET permission = rebuilt.permission
FROM rebuilt
WHERE role.id = rebuilt.id;

COMMIT;
