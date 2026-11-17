import {
  moneyMovementKindName,
  movementStatus,
  movementStatusName,
  type FinanceModel,
  type MovementRecord,
} from "./model";
import {
  supplierLedgerKindName,
  type SupplierEntryRecord,
  type SupplierLedgerModel,
} from "./suppliers/model";

export abstract class FinanceFormatter {
  static toMovement(row: MovementRecord): FinanceModel["movement"] {
    return {
      uuid: row.uuid,
      kind: moneyMovementKindName(row.entryKind),
      status: movementStatusName(row.status),
      currencyCode: row.currencyCode,
      amount: row.amount.toString(),
      occurredAt: row.occurredAt.toISOString().slice(0, 10),
      note: row.note,
      supplierUuid: row.supplier?.uuid ?? null,
      supplierName: row.supplier?.name ?? null,
      purchaseOrderUuid: row.purchaseOrder?.uuid ?? null,
      purchaseOrderReference: row.purchaseOrder?.reference ?? null,
      pricingIncomplete: row.pricingIncomplete,
      pricingIssueCount: row.pricingIssueCount,
      saleUuid: row.build?.uuid ?? null,
      saleReference: row.build?.reference ?? null,
      // Exactly one document owns a movement's money: a sale receipt follows
      // its sale branch and a purchase follows its order origin. A reversal
      // copies the same links, so it keeps the source provenance.
      branchUuid:
        row.build?.branch.uuid ?? row.purchaseOrder?.branch?.uuid ?? null,
      branchName:
        row.build?.branch.name ?? row.purchaseOrder?.branch?.name ?? null,
      reversalOfUuid: row.reversalOf?.uuid ?? null,
      reversed: row.reversal !== null,
      // One linked negation at most, only for a posted nonzero original: a
      // reservation or a cancelled row has no cash to reverse.
      reversible:
        row.status === movementStatus.posted &&
        row.reversalOf === null &&
        row.reversal === null &&
        !row.amount.isZero(),
      createdAt: row.createdAt.toISOString(),
      createdById: row.createdById,
    };
  }

  static toSupplierEntry(
    row: SupplierEntryRecord,
  ): SupplierLedgerModel["entry"] {
    return {
      uuid: row.uuid,
      kind: supplierLedgerKindName(row.entryKind),
      currencyCode: row.currencyCode,
      amount: row.amount.toString(),
      occurredAt: row.occurredAt.toISOString().slice(0, 10),
      note: row.note,
      purchaseOrderUuid: row.purchaseOrder?.uuid ?? null,
      purchaseOrderReference: row.purchaseOrder?.reference ?? null,
      branchUuid: row.purchaseOrder?.branch?.uuid ?? null,
      branchName: row.purchaseOrder?.branch?.name ?? null,
      moneyMovementUuid: row.moneyMovement?.uuid ?? null,
      reversalOfUuid: row.reversalOf?.uuid ?? null,
      reversed: row.reversal !== null,
      createdAt: row.createdAt.toISOString(),
      createdById: row.createdById,
    };
  }
}
