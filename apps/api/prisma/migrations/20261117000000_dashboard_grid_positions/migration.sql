-- Dashboard definition version 2: explicit grid coordinates.
--
-- Forward-only migration for the personal dashboard layout. It rewrites only
-- the JSON `definition` of rows in the existing `dashboard` table, bumps their
-- optimistic `revision`, and moves the stored schema version from 1 to 2. It
-- creates/drops no table and deletes no business data.
--
-- Version 1 defined placement only by array order plus a width/height enum.
-- Version 2 stores `x` (starting column, 0-3) and `y` (starting row) on every
-- widget; the width enum still decides the four-column span (quarter=1,
-- half=2, full=4) and the type/height pair decides the row span (KPI
-- short/normal/tall = 3/4/5 rows, charts = 7/8/10 rows). The widget array order,
-- UUIDs, titles, sources, measures, groupings, series, ranges and filters are
-- preserved exactly.
--
-- Placement is deterministic first-fit in the four-column grid: widgets are
-- visited in their stored array order and each one takes the first free
-- rectangle scanning rows top-down and columns left-to-right. Because the old
-- order is retained, the migrated layout keeps its relative reading order and
-- can never contain overlapping cards.
--
-- `revision` is incremented so a writer holding a pre-migration revision gets
-- the normal 409 conflict instead of silently overwriting the migrated layout.

BEGIN;

ALTER TABLE "dashboard" ALTER COLUMN "schema_version" SET DEFAULT 2;
ALTER TABLE "dashboard"
  DROP CONSTRAINT "dashboard_schema_version_check";

DO $$
DECLARE
  board RECORD;
  entry JSONB;
  placed_widgets JSONB;
  next_definition JSONB;
  column_span INT;
  row_span INT;
  target_x INT;
  target_y INT;
  placed BOOLEAN;
  sweep_x INT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS dashboard_grid_cells (
    x INT NOT NULL,
    y INT NOT NULL
  ) ON COMMIT DROP;

  FOR board IN SELECT id, definition FROM dashboard LOOP
    TRUNCATE dashboard_grid_cells;
    placed_widgets := '[]'::JSONB;

    FOR entry IN
      SELECT value FROM jsonb_array_elements(board.definition -> 'widgets')
    LOOP
      column_span := CASE entry ->> 'width'
        WHEN 'quarter' THEN 1
        WHEN 'half' THEN 2
        ELSE 4
      END;
      row_span := CASE
        WHEN entry ->> 'type' = 'kpi' THEN
          CASE entry ->> 'height'
            WHEN 'short' THEN 3
            WHEN 'tall' THEN 5
            ELSE 4
          END
        ELSE
          CASE entry ->> 'height'
            WHEN 'short' THEN 7
            WHEN 'tall' THEN 10
            ELSE 8
          END
      END;

      target_y := 0;
      placed := FALSE;
      WHILE NOT placed LOOP
        FOR sweep_x IN 0..(4 - column_span) LOOP
          IF NOT EXISTS (
            SELECT 1
            FROM dashboard_grid_cells
            WHERE x BETWEEN sweep_x AND sweep_x + column_span - 1
              AND y BETWEEN target_y AND target_y + row_span - 1
          ) THEN
            target_x := sweep_x;
            placed := TRUE;
            EXIT;
          END IF;
        END LOOP;
        IF NOT placed THEN
          target_y := target_y + 1;
        END IF;
      END LOOP;

      INSERT INTO dashboard_grid_cells (x, y)
      SELECT cell_x, cell_y
      FROM generate_series(target_x, target_x + column_span - 1) AS cell_x,
           generate_series(target_y, target_y + row_span - 1) AS cell_y;

      placed_widgets := placed_widgets || jsonb_build_array(
        entry || jsonb_build_object('x', target_x, 'y', target_y)
      );
    END LOOP;

    next_definition := jsonb_set(
      board.definition,
      '{widgets}',
      placed_widgets,
      TRUE
    );
    next_definition := jsonb_set(next_definition, '{version}', '2'::JSONB, TRUE);

    UPDATE dashboard
    SET definition = next_definition,
        schema_version = 2,
        revision = revision + 1
    WHERE id = board.id;
  END LOOP;
END $$;

ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_schema_version_check"
  CHECK ("schema_version" = 2);
ALTER TABLE "dashboard"
  ADD CONSTRAINT "dashboard_definition_version_check"
  CHECK (("definition" ->> 'version') = '2');

COMMIT;
