import type { ReceiveModel, ReceiptRecord } from "./model";

export abstract class ReceiptsFormatter {
  static toReceipt(row: ReceiptRecord): ReceiveModel["receipt"] {
    return {
      uuid: row.uuid,
      orderUuid: row.order.uuid,
      lineUuid: row.line.uuid,
      branchUuid: row.branch.uuid,
      branch: row.branch,
      itemUuid: row.itemUuid,
      quantity: row.quantity.toString(),
      stockQuantity: row.stockQuantity?.toString() ?? null,
      unitCode: row.unitCode,
      packQuantityNative: row.packQuantityNative?.toString() ?? null,
      purchasePrice: row.purchasePrice?.toString() ?? null,
      discount: row.discount?.toString() ?? null,
      currencyCode: row.currencyCode,
      notes: row.notes,
      userId: row.userId,
      occurredAt: row.occurredAt?.toISOString() ?? null,
      legacyBaseline: row.legacyBaseline,
      reversalOfUuid: row.reversalOf?.uuid ?? null,
      reversalUuid: row.reversal?.uuid ?? null,
    };
  }
}
