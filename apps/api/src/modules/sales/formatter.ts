import type { Prisma } from "../../../prisma/generated/prisma/client";
import type {
  SaleReceiptRecord,
  SalesModel,
  SalesRecord,
  SalesSummaryRecord,
} from "./model";

export abstract class SalesFormatter {
  static toSummary(row: SalesSummaryRecord): SalesModel["summary"] {
    const {
      requestedRecipeUuid,
      channel,
      batch,
      totalPrice,
      branch,
      ...summary
    } = row;
    return {
      ...summary,
      recipeUuid: requestedRecipeUuid,
      referenceInt: row.referenceInt.toString(),
      totalPrice: totalPrice?.toString() ?? null,
      branch: { uuid: branch.uuid, name: branch.name },
      channelUuid: channel?.uuid ?? null,
      channelName: channel?.name ?? null,
      businessDate: row.businessDate?.toISOString().slice(0, 10) ?? null,
      batchUuid: batch?.uuid ?? null,
      batchReference: batch?.reference ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  static toSale(
    row: Omit<SalesRecord, "id">,
    receipts: SaleReceiptRecord[],
    collected: Prisma.Decimal,
  ): SalesModel["sale"] {
    const {
      components,
      consumptions,
      unitPrice,
      recipeDefinitionUuid,
      recipeSourceVersion,
      ...summary
    } = row;
    const total = row.totalPrice;
    return {
      ...SalesFormatter.toSummary(summary),
      unitPrice: unitPrice?.toString() ?? null,
      recipeDefinitionUuid,
      recipeSourceVersion,
      collectedAmount:
        total === null ? null : collected.toDecimalPlaces(6).toString(),
      outstandingAmount:
        total === null
          ? null
          : total.minus(collected).toDecimalPlaces(6).toString(),
      ingredients: components.map((component) => {
        const {
          uuid,
          recipeLineUuidRef,
          componentUuidRef,
          componentName,
          componentIpn,
          componentUnits,
          recipeQuantity,
          requiredQuantity,
          consumedQuantity,
          note,
        } = component;
        return {
          uuid,
          recipeLineUuid: recipeLineUuidRef,
          itemUuid: componentUuidRef,
          itemName: componentName,
          itemIpn: componentIpn,
          itemUnits: componentUnits,
          quantityPerRecipe: recipeQuantity.toString(),
          requiredQuantity: requiredQuantity.toString(),
          consumedQuantity: consumedQuantity.toString(),
          note,
        };
      }),
      consumptionCount: consumptions.length,
      consumptions: consumptions.map((consumption) => {
        const {
          uuid,
          buildComponent,
          itemUuidRef,
          item,
          quantity,
          quantityBefore,
          quantityAfter,
          createdAt,
          createdById,
          createdByName,
        } = consumption;
        return {
          uuid,
          buildComponentUuid: buildComponent.uuid,
          itemUuidRef,
          itemUuid: item?.uuid ?? null,
          quantity: quantity.toString(),
          quantityBefore: quantityBefore.toString(),
          quantityAfter: quantityAfter.toString(),
          createdAt: createdAt.toISOString(),
          createdById,
          createdByName,
        };
      }),
      receipts: receipts.map((receipt) => ({
        uuid: receipt.uuid,
        kind: (receipt.entryKind === 90 ? "reversal" : "receipt") as
          "receipt" | "reversal",
        amount: receipt.amount.toString(),
        occurredAt: receipt.occurredAt.toISOString().slice(0, 10),
        note: receipt.note,
        reversalOfUuid: receipt.reversalOf?.uuid ?? null,
        reversed: receipt.reversal !== null,
        createdAt: receipt.createdAt.toISOString(),
        createdById: receipt.createdById,
      })),
    };
  }
}
