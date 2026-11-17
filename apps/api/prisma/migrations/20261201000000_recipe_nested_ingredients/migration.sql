-- Nested recipe ingredients.
-- Forward migration for the state produced by 20261130000000_pos_devices_z_reports.
-- It does not record that it was applied and it has not been executed against
-- any database by this change. Prisma does not wrap a PostgreSQL migration in a
-- transaction, so this file is one explicit BEGIN/COMMIT block.
--
-- Data handling:
--   * `recipe_line` gains a nullable `child_recipe_id`. Every existing row stays
--     a plain item ingredient with `child_recipe_id` NULL, so no historical
--     recipe changes meaning and no row is rewritten.
--   * `item_id` becomes nullable so a line can reference another recipe instead
--     of an item. All existing values are unchanged.
--   * The check constraint requires exactly one of `item_id` and
--     `child_recipe_id`, so a line can never be both or neither.
--   * `UNIQUE(recipe_id, child_recipe_id)` rejects the same child recipe twice.
--     PostgreSQL treats NULLs as distinct, so the existing
--     `UNIQUE(recipe_id, item_id)` still permits several recipe lines with a
--     NULL item, as intended.
--   * Both `(organization_id, item_id)` and `(organization_id, child_recipe_id)`
--     are RESTRICT same-organization foreign keys: an ingredient item or a
--     referenced child recipe cannot be deleted while a line uses it, and a line
--     can never point across organizations.
--   * Deleting a parent recipe still cascades its own lines only; the referenced
--     child recipe is a separate row and is never deleted.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that writes and expands recipe references.

BEGIN;

ALTER TABLE "recipe_line"
  ALTER COLUMN "item_id" DROP NOT NULL,
  ADD COLUMN "child_recipe_id" INTEGER;

ALTER TABLE "recipe_line"
  ADD CONSTRAINT "recipe_line_ingredient_xor_check"
  CHECK (
    (CASE WHEN "item_id" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "child_recipe_id" IS NULL THEN 0 ELSE 1 END) = 1
  );

CREATE UNIQUE INDEX "recipe_line_recipe_id_child_recipe_id_key"
  ON "recipe_line"("recipe_id", "child_recipe_id");
CREATE INDEX "recipe_line_child_recipe_id_idx"
  ON "recipe_line"("child_recipe_id");

ALTER TABLE "recipe_line" ADD CONSTRAINT "recipe_line_organization_id_child_recipe_id_fkey"
  FOREIGN KEY ("organization_id", "child_recipe_id")
  REFERENCES "recipe"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

COMMIT;
