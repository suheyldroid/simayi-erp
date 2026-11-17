-- Dashboard definition version 3: native grid dimensions.
--
-- Forward-only migration for the personal dashboard layout. It rewrites only
-- the JSON `definition` of rows in the existing `dashboard` table, bumps their
-- optimistic `revision`, and moves the stored schema version from 2 to 3. It
-- creates/drops no table or column, adds no index, and deletes no business data.
--
-- Version 2 stored a `width` enum that implied the column span (quarter=1,
-- half=2, full=4) and a `height` enum that implied the row span from the card
-- type (KPI short/normal/tall = 3/4/5 rows, charts = 7/8/10 rows). Version 3
-- stores that same geometry as the explicit native grid integers `w` and `h`
-- next to the existing `x` and `y`, so every card keeps the exact footprint it
-- had while the enum keys disappear. `id`, `type`, `title`, all card options,
-- `x`, `y` and the widget array order are preserved as-is. Only the two size
-- keys are replaced with `w`/`h`; no `x` or `y` value is recalculated, so the
-- already non-overlapping v2 placement stays valid.
--
-- `schema_version` default and both check constraints move to 3 together, and
-- `revision` is incremented so a writer holding a pre-migration revision gets
-- the normal 409 conflict instead of silently overwriting the migrated layout.
-- Dashboards with no widgets keep their empty array.

BEGIN;

ALTER TABLE "dashboard" ALTER COLUMN "schema_version" SET DEFAULT 3;
ALTER TABLE "dashboard"
  DROP CONSTRAINT "dashboard_schema_version_check";
ALTER TABLE "dashboard"
  DROP CONSTRAINT "dashboard_definition_version_check";

UPDATE "dashboard" AS board
SET "definition" = jsonb_set(
      jsonb_set(
        board."definition",
        '{widgets}',
        COALESCE(
          (
            SELECT jsonb_agg(
              (entry.value - 'width' - 'height') || jsonb_build_object(
                'w', CASE entry.value ->> 'width'
                  WHEN 'quarter' THEN 1
                  WHEN 'half' THEN 2
                  WHEN 'full' THEN 4
                  ELSE 1
                END,
                'h', CASE
                  WHEN entry.value ->> 'type' = 'kpi' THEN
                    CASE entry.value ->> 'height'
                      WHEN 'short' THEN 3
                      WHEN 'tall' THEN 5
                      ELSE 4
                    END
                  ELSE
                    CASE entry.value ->> 'height'
                      WHEN 'short' THEN 7
                      WHEN 'tall' THEN 10
                      ELSE 8
                    END
                END
              )
              ORDER BY entry.position
            )
            FROM jsonb_array_elements(board."definition" -> 'widgets')
              WITH ORDINALITY AS entry(value, position)
          ),
          '[]'::JSONB
        ),
        TRUE
      ),
      '{version}',
      '3'::JSONB,
      TRUE
    ),
    "schema_version" = 3,
    "revision" = board."revision" + 1;

ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_schema_version_check"
  CHECK ("schema_version" = 3);
ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_definition_version_check"
  CHECK (("definition" ->> 'version') = '3');

COMMIT;
