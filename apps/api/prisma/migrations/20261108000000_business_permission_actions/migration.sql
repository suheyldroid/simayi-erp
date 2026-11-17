-- Rename the business permission action vocabulary in stored dynamic-role
-- grants. This file is a forward migration. It does not record that it was
-- applied. Apply it in a maintenance window after a backup, with writers
-- stopped, and apply it before the new code starts: the new permission reader
-- accepts only create, read, update, and delete for the business scopes and
-- rejects any stored row that still holds an old business action name.
--
-- Vocabulary map, one-to-one, with no implied or added grants:
--   view   -> read
--   add    -> create
--   change -> update
--   delete -> delete
--
-- Only the ten business scopes are rewritten: erp_settings, item_category,
-- item, recipe, stock, build, purchase_order, sales_order, return_order, and
-- transfer_order. Every other resource key keeps its exact value, including
-- native organization, member, invitation, team, ac, and ownership grants and
-- any unknown key. Inside a business scope only exact string actions are
-- renamed; any other element keeps its value, so nothing is discarded.
--
-- Each business action array keeps its original order and duplicate entries.
-- Old and new entries for the same grant both map to the canonical new name,
-- so they can leave duplicate entries, for example [view,read] becomes
-- [read,read]. No old business action name survives in a business scope; the
-- map is one-to-one, so no permission is added or removed. Empty arrays stay
-- empty.
--
-- The body is parsed with permission::jsonb. Invalid JSON, or a business scope
-- value that is not a JSON array, makes the statement fail and rolls the whole
-- transaction back, exactly like the runtime reader that rejects such a stored
-- row; no body is skipped, defaulted, or fabricated. Rebuilt rows are stored as
-- jsonb text, so whitespace and key order are normalized while every value is
-- preserved.
--
-- The script removes no table, column, row, or key. It is idempotent: a second
-- run finds no old business action name and updates nothing. It has not been
-- executed against any database by this change.

BEGIN;

LOCK TABLE "organization_role" IN ACCESS EXCLUSIVE MODE;

WITH current AS (
  SELECT id, permission::jsonb AS body
  FROM "organization_role"
),
entries AS (
  SELECT
    current.id,
    entry.key,
    CASE
      WHEN entry.key IN (
        'erp_settings',
        'item_category',
        'item',
        'recipe',
        'stock',
        'build',
        'purchase_order',
        'sales_order',
        'return_order',
        'transfer_order'
      )
      THEN COALESCE((
        SELECT jsonb_agg(
          CASE element.value #>> '{}'
            WHEN 'view' THEN to_jsonb('read'::text)
            WHEN 'add' THEN to_jsonb('create'::text)
            WHEN 'change' THEN to_jsonb('update'::text)
            ELSE element.value
          END
          ORDER BY element.ordinality
        )
        FROM jsonb_array_elements(entry.value)
          WITH ORDINALITY AS element(value, ordinality)
      ), '[]'::jsonb)
      ELSE entry.value
    END AS value
  FROM current
  CROSS JOIN LATERAL jsonb_each(current.body) AS entry(key, value)
),
rebuilt AS (
  SELECT id, jsonb_object_agg(key, value) AS body
  FROM entries
  GROUP BY id
)
UPDATE "organization_role" AS role
SET permission = rebuilt.body::text
FROM rebuilt
WHERE role.id = rebuilt.id
  AND role.permission::jsonb IS DISTINCT FROM rebuilt.body;

COMMIT;
