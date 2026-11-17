import { CatalogService } from "@/lib/catalog";
import { PurchaseOrdersFormatter } from "../formatter";
import type { ExtraLinesModel, ExtraLinesRecord } from "./model";

export abstract class ExtraLinesFormatter {
  static toLine(
    row: ExtraLinesRecord,
    orderUuid: string,
  ): ExtraLinesModel["line"] {
    return {
      uuid: row.uuid,
      orderUuid,
      description: row.description,
      quantity: row.quantity.toString(),
      discount: row.discount.toString(),
      price: row.price?.toString() ?? null,
      currencyCode: row.currencyCode,
      line: row.line,
      lineInt: row.lineInt,
      reference: row.reference,
      notes: row.notes,
      link: row.link,
      targetDate: PurchaseOrdersFormatter.day(row.targetDate),
      context: CatalogService.jsonObject(row.context),
    };
  }
}
