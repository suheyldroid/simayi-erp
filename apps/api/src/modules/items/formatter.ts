import { CatalogService } from "@/lib/catalog";
import { withoutKeys } from "@/lib/publish";
import type { ItemRecord, ItemsModel } from "./model";

export abstract class ItemsFormatter {
  static toItem(row: ItemRecord): ItemsModel["item"] {
    return {
      ...withoutKeys(row, [
        "id",
        "categoryId",
        "category",
        "unitId",
        "unit",
        "_count",
      ]),
      hasReceipts: row._count.purchaseReceipts > 0,
      units: row.unit?.code ?? "",
      unitUuid: row.unit?.uuid ?? null,
      unit: row.unit,
      creationDate: CatalogService.day(row.creationDate),
      categoryUuid: row.category?.uuid ?? null,
      category: row.category,
    };
  }
}
