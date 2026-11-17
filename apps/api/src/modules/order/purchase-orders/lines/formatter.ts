import { PurchaseOrdersFormatter } from "../formatter";
import type { LinesModel, LinesRecord } from "./model";

export abstract class LinesFormatter {
  static toLine(row: LinesRecord, orderUuid: string): LinesModel["line"] {
    return {
      uuid: row.uuid,
      orderUuid,
      itemUuid: row.item?.uuid ?? null,
      item: row.item,
      packQuantityNative: row.packQuantityNative?.toString() ?? null,
      unitCode: row.unitCode,
      quantity: row.quantity.toString(),
      received: row.received.toString(),
      discount: row.discount.toString(),
      purchasePrice: row.purchasePrice?.toString() ?? null,
      currencyCode: row.currencyCode,
      line: row.line,
      lineInt: row.lineInt,
      reference: row.reference,
      notes: row.notes,
      link: row.link,
      targetDate: PurchaseOrdersFormatter.day(row.targetDate),
      receiptEventCount: row._count.receipts,
    };
  }
}
