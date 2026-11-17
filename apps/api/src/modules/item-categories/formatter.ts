import { withoutKeys } from "@/lib/publish";
import type { CategoryRecord, ItemCategoriesModel } from "./model";

export abstract class ItemCategoriesFormatter {
  static toCategory(row: CategoryRecord): ItemCategoriesModel["category"] {
    return {
      ...withoutKeys(row, ["id", "parentId", "_count", "parent"]),
      parentUuid: row.parent?.uuid ?? null,
      childCount: row._count.children,
      itemCount: row._count.parts,
    };
  }
}
