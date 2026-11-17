import type { EffectiveRecipe, RecipesModel } from "./model";

export abstract class RecipesFormatter {
  static toSummary(row: EffectiveRecipe): RecipesModel["summary"] {
    return {
      uuid: row.uuid,
      scope: row.scope,
      name: row.name,
      code: row.code,
      description: row.description,
      branch: row.branch,
      sellingPrice: row.sellingPrice?.toString() ?? null,
      priceCurrencyCode: row.priceCurrencyCode,
      active: row.active,
      sellable: row.sellable,
      version: row.version,
      sourceRecipeUuid: row.sourceUuid,
      sourceVersion: row.sourceVersion,
      sourceRecipeActive: row.sourceActive,
      customizationUuid: row.customizationUuid,
      activation: row.activation,
      ingredientCount: row.ingredientCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  static toDetail(
    row: EffectiveRecipe,
    graph: ReadonlyMap<number, EffectiveRecipe>,
  ): RecipesModel["detail"] {
    return {
      ...RecipesFormatter.toSummary(row),
      ingredients: row.lines.map((line) => {
        if (line.childRecipeId !== null) {
          const child = graph.get(line.childRecipeId);
          if (!child)
            throw new Error(
              "An effective ingredient recipe was not resolved in this context",
            );
          return {
            kind: "recipe" as const,
            uuid: line.uuid,
            recipeUuid: child.uuid,
            recipe: RecipesFormatter.toSummary(child),
            quantity: line.quantity.toString(),
            note: line.note,
          };
        }
        const item = line.item;
        if (!item)
          throw new Error("A recipe line must reference an item or a recipe");
        return {
          kind: "item" as const,
          uuid: line.uuid,
          itemUuid: item.uuid,
          item: {
            uuid: item.uuid,
            name: item.name,
            ipn: item.ipn,
            units: item.unit?.code ?? "",
          },
          quantity: line.quantity.toString(),
          note: line.note,
        };
      }),
    };
  }
}
