import { CatalogService } from "@/lib/catalog";
import type { TrackingModel, TrackingRecord } from "./model";

export abstract class TrackingFormatter {
  static present(row: TrackingRecord): TrackingModel["entry"] {
    const { item, branch, ...entry } = row;
    return {
      ...entry,
      date: row.date.toISOString(),
      deltas: row.deltas == null ? null : CatalogService.jsonObject(row.deltas),
      quantityBefore:
        row.quantityBefore == null ? null : row.quantityBefore.toString(),
      quantityAfter:
        row.quantityAfter == null ? null : row.quantityAfter.toString(),
      itemUuid: item?.uuid ?? null,
      branchUuid: branch.uuid,
    };
  }
}
