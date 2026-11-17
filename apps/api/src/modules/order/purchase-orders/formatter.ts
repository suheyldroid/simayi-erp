import createError from "http-errors";
import { purchaseOrderStatusLabel } from "@/lib/status";
import {
  purchaseOrderStatuses,
  type PurchaseOrdersModel,
  type PurchaseOrdersRecord,
} from "./model";

export abstract class PurchaseOrdersFormatter {
  static toOrder(order: PurchaseOrdersRecord): PurchaseOrdersModel["order"] {
    if (!purchaseOrderStatuses.has(order.status))
      throw new createError.InternalServerError(
        "Unknown purchase order status",
      );
    return {
      uuid: order.uuid,
      reference: order.reference,
      referenceInt: order.referenceInt.toString(),
      barcodeData: order.barcodeData,
      barcodeHash: order.barcodeHash,
      description: order.description,
      link: order.link,
      supplierReference: order.supplierReference,
      branchUuid: order.branch?.uuid ?? null,
      branch: order.branch,
      createdById: order.createdById,
      receivedById: order.receivedById,
      status: order.status as PurchaseOrdersModel["order"]["status"],
      statusLabel: purchaseOrderStatusLabel(order.status),
      supplierUuid: order.supplier?.uuid ?? null,
      supplier: order.supplier,
      responsibleUuid: order.responsible?.uuid ?? null,
      totalPrice: order.totalPrice?.toString() ?? null,
      startDate: PurchaseOrdersFormatter.day(order.startDate),
      targetDate: PurchaseOrdersFormatter.day(order.targetDate),
      creationDate: PurchaseOrdersFormatter.day(order.creationDate),
      issueDate: PurchaseOrdersFormatter.day(order.issueDate),
      completeDate: PurchaseOrdersFormatter.day(order.completeDate),
      version: order.version,
    };
  }

  static day(value: Date | null): string | null {
    return value == null ? null : value.toISOString().slice(0, 10);
  }
}
