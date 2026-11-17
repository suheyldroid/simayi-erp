import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { Decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { FinanceFormatter } from "../formatter";
import { moneyMovementKind } from "../model";
import { FinanceService } from "../service";
import {
  supplierEntrySelect,
  supplierLedgerKind,
  type SupplierLedgerModel,
} from "./model";

export abstract class SupplierLedgerService {
  /**
   * Paginated supplier ledger in the organization finance currency. The
   * outstanding balance is the exact sum of every posted row, including
   * reversals, and may legitimately stay negative for a supplier advance.
   */
  static async index(
    actor: TenantActor,
    supplierUuid: string,
    query: SupplierLedgerModel["query"],
  ): Promise<SupplierLedgerModel["ledger"]> {
    const organizationId = actor.organizationId;
    const supplier = await FinanceService.supplier(
      prisma,
      organizationId,
      supplierUuid,
    );
    const currencyCode = await FinanceService.currentCurrency(
      prisma,
      organizationId,
    );
    const where: Prisma.SupplierLedgerEntryWhereInput = {
      organizationId,
      supplierId: supplier.id,
    };
    const [rows, total, sum] = await prisma.$transaction([
      prisma.supplierLedgerEntry.findMany({
        where,
        select: supplierEntrySelect,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.supplierLedgerEntry.count({ where }),
      prisma.supplierLedgerEntry.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);
    const outstanding = sum._sum.amount ?? new Decimal(0);
    return {
      configured: currencyCode !== null,
      currencyCode,
      outstanding: outstanding.toString(),
      items: rows.map((row) => FinanceFormatter.toSupplierEntry(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * One supplier payment: exact cash outflow plus the same exact debt
   * reduction in one transaction. A supplier credit balance is allowed.
   */
  static async storePayment(
    actor: TenantActor,
    supplierUuid: string,
    body: SupplierLedgerModel["positiveMoneyBody"],
  ): Promise<SupplierLedgerModel["entry"]> {
    const organizationId = actor.organizationId;
    const requestKey = FinanceService.requestKey(body.requestKey);
    return FinanceService.write(async (db) => {
      const supplier = await FinanceService.supplier(
        db,
        organizationId,
        supplierUuid,
      );
      const currencyCode = await FinanceService.currency(db, organizationId);
      const replayed = await db.supplierLedgerEntry.findFirst({
        where: { organizationId, requestKey },
        select: supplierEntrySelect,
      });
      if (replayed) {
        if (
          replayed.entryKind !== supplierLedgerKind.payment ||
          replayed.supplierId !== supplier.id
        )
          throw new createError.Conflict(
            "This request key belongs to a different supplier entry",
          );
        return FinanceFormatter.toSupplierEntry(replayed);
      }
      const amount = FinanceService.money(body.amount);
      const occurredAt = FinanceService.day(body.date);
      const note = body.note?.trim() ?? "";
      const movement = await db.moneyMovement.create({
        data: {
          organizationId,
          entryKind: moneyMovementKind.supplierPayment,
          currencyCode,
          amount: amount.neg(),
          occurredAt,
          note,
          supplierId: supplier.id,
          createdById: actor.userId,
        },
        select: { id: true },
      });
      const created = await db.supplierLedgerEntry.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          entryKind: supplierLedgerKind.payment,
          currencyCode,
          amount: amount.neg(),
          occurredAt,
          note,
          requestKey,
          moneyMovementId: movement.id,
          createdById: actor.userId,
        },
        select: supplierEntrySelect,
      });
      return FinanceFormatter.toSupplierEntry(created);
    });
  }
}
