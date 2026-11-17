import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { Decimal, decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { OrderService } from "../order/service";
import { SystemPreferencesService } from "../system-preferences/service";
import { FinanceFormatter } from "./formatter";
import {
  moneyMovementKind,
  movementSelect,
  movementStatus,
  type Database,
  type FinanceModel,
} from "./model";
import { supplierLedgerKind } from "./suppliers/model";

/** One validated money input, exact and never a JavaScript number. */
type MoneyAmount = Prisma.Decimal;

export abstract class FinanceService {
  /**
   * Advisory lock taken after every existing business lock (catalog 814203,
   * recipes 814204, stock 814205, order 814206). No transaction acquires a
   * catalog, recipe, stock or order lock after this one.
   */
  static async lock(db: Prisma.TransactionClient): Promise<void> {
    // pg_advisory_xact_lock returns void; execute it without a result row.
    await db.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(814207::bigint)`,
    );
  }

  static async write<T>(
    run: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(
      async (db) => {
        await FinanceService.lock(db);
        return run(db);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20000,
      },
    );
  }

  /** Read-only currency lookup. Never creates the finance row. */
  static async currentCurrency(
    db: Database,
    organizationId: string,
  ): Promise<string | null> {
    const row = await db.organizationFinance.findUnique({
      where: { organizationId },
      select: { currencyCode: true },
    });
    return row?.currencyCode ?? null;
  }

  /**
   * Currency for a new monetary write. It is always the fixed system currency:
   * an organization whose recorded finance row uses another code is a legacy
   * conflict and fails rather than mixing or relabelling history. A read never
   * creates the row.
   */
  static async currency(
    db: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string> {
    await FinanceService.lock(db);
    const systemCurrency = await SystemPreferencesService.requireCurrency(db);
    const existing = await db.organizationFinance.findUnique({
      where: { organizationId },
      select: { currencyCode: true },
    });
    if (existing === null) {
      await db.organizationFinance.create({
        data: { organizationId, currencyCode: systemCurrency },
      });
      return systemCurrency;
    }
    if (existing.currencyCode !== systemCurrency)
      throw new createError.Conflict(
        `This organization records money in ${existing.currencyCode}, but the fixed system currency is ${systemCurrency}; new monetary entries cannot mix currencies. Reconcile the recorded finance history before recording new money.`,
      );
    return existing.currencyCode;
  }

  /** Exact positive money value with at most 6 fraction and 13 integer digits. */
  static money(value: string): MoneyAmount {
    const parsed = decimal(value.trim(), 6, 13);
    if (parsed.isZero())
      throw new createError.UnprocessableEntity("Amount must not be zero");
    if (parsed.lt(0))
      throw new createError.UnprocessableEntity(
        "Amount must be greater than zero",
      );
    return parsed;
  }

  static day(value: string): Date {
    return OrderService.day(value);
  }

  static today(): Date {
    return OrderService.today();
  }

  static requestKey(value: string): string {
    const key = value.trim();
    if (key === "")
      throw new createError.UnprocessableEntity("A request key is required");
    return key;
  }

  static async summary(actor: TenantActor): Promise<FinanceModel["summary"]> {
    const organizationId = actor.organizationId;
    // One coherent snapshot: the posted balance, the hold and their counters
    // must describe the same commit, so a completion cannot land between them.
    const [finance, posted, held, movementCount, pendingPricingCount] =
      await prisma.$transaction(
        [
          prisma.organizationFinance.findUnique({
            where: { organizationId },
            select: { currencyCode: true },
          }),
          prisma.moneyMovement.aggregate({
            where: { organizationId, status: movementStatus.posted },
            _sum: { amount: true },
          }),
          prisma.moneyMovement.aggregate({
            where: { organizationId, status: movementStatus.onHold },
            _sum: { amount: true },
          }),
          prisma.moneyMovement.count({
            where: { organizationId, status: movementStatus.posted },
          }),
          prisma.moneyMovement.count({
            where: {
              organizationId,
              status: movementStatus.onHold,
              pricingIncomplete: true,
            },
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    const balance = posted._sum.amount ?? new Decimal(0);
    // A reservation is stored as the negative outflow it anticipates; the
    // exposed hold is the positive amount still expected to leave the cash.
    const heldAmount = held._sum.amount ?? new Decimal(0);
    const onHold = heldAmount.isZero() ? new Decimal(0) : heldAmount.neg();
    return {
      configured: finance !== null,
      currencyCode: finance?.currencyCode ?? null,
      balance: balance.toString(),
      onHold: onHold.toString(),
      availableBalance: balance.minus(onHold).toString(),
      movementCount,
      pendingPricingCount,
    };
  }

  static async index(
    actor: TenantActor,
    query: FinanceModel["query"],
  ): Promise<FinanceModel["list"]> {
    const organizationId = actor.organizationId;
    const search = query.search?.trim();
    const where: Prisma.MoneyMovementWhereInput = {
      organizationId,
      ...(search
        ? {
            OR: [
              { note: { contains: search, mode: "insensitive" } },
              {
                supplier: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
              {
                build: {
                  reference: { contains: search, mode: "insensitive" },
                },
              },
              {
                purchaseOrder: {
                  reference: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.moneyMovement.findMany({
        where,
        select: movementSelect,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.moneyMovement.count({ where }),
    ]);
    return {
      items: rows.map((row) => FinanceFormatter.toMovement(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<FinanceModel["movement"]> {
    const row = await prisma.moneyMovement.findFirst({
      where: { organizationId: actor.organizationId, uuid },
      select: movementSelect,
    });
    if (!row) throw new createError.NotFound("Money movement was not found");
    return FinanceFormatter.toMovement(row);
  }

  static async income(
    actor: TenantActor,
    body: FinanceModel["positiveMoneyBody"],
  ): Promise<FinanceModel["movement"]> {
    return FinanceService.manual(actor, moneyMovementKind.income, body, false);
  }

  static async expense(
    actor: TenantActor,
    body: FinanceModel["positiveMoneyBody"],
  ): Promise<FinanceModel["movement"]> {
    return FinanceService.manual(actor, moneyMovementKind.expense, body, true);
  }

  private static async manual(
    actor: TenantActor,
    entryKind: number,
    body: FinanceModel["positiveMoneyBody"],
    outward: boolean,
  ): Promise<FinanceModel["movement"]> {
    const organizationId = actor.organizationId;
    const requestKey = FinanceService.requestKey(body.requestKey);
    return FinanceService.write(async (db) => {
      const currencyCode = await FinanceService.currency(db, organizationId);
      const replayed = await db.moneyMovement.findFirst({
        where: { organizationId, requestKey },
        select: movementSelect,
      });
      if (replayed) {
        if (replayed.entryKind !== entryKind)
          throw new createError.Conflict(
            "This request key belongs to a different money entry",
          );
        return FinanceFormatter.toMovement(replayed);
      }
      const amount = FinanceService.money(body.amount);
      const created = await db.moneyMovement.create({
        data: {
          organizationId,
          entryKind,
          currencyCode,
          amount: outward ? amount.neg() : amount,
          occurredAt: FinanceService.day(body.date),
          note: body.note?.trim() ?? "",
          requestKey,
          createdById: actor.userId,
        },
        select: movementSelect,
      });
      return FinanceFormatter.toMovement(created);
    });
  }

  /** Cash inflow recorded against one priced sale. */
  static async receipt(
    actor: TenantActor,
    saleUuid: string,
    body: FinanceModel["positiveMoneyBody"],
  ): Promise<FinanceModel["movement"]> {
    const organizationId = actor.organizationId;
    const requestKey = FinanceService.requestKey(body.requestKey);
    return FinanceService.write(async (db) => {
      const build = await db.build.findFirst({
        where: { organizationId, uuid: saleUuid },
        select: {
          id: true,
          uuid: true,
          branchId: true,
          totalPrice: true,
          currencyCode: true,
        },
      });
      if (!build) throw new createError.NotFound("Sale was not found");
      // The cash ledger is company-wide, but a selected branch narrows this
      // action to its own sales: recording money against another branch's sale
      // would reclassify it. Cross-branch is the same 404 as an unknown sale so
      // branch UUIDs cannot be probed. Without a branch context the receipt
      // stays an explicit company finance action.
      if (actor.branchId !== null && build.branchId !== actor.branchId)
        throw new createError.NotFound("Sale was not found");
      const replayed = await db.moneyMovement.findFirst({
        where: { organizationId, requestKey },
        select: movementSelect,
      });
      if (replayed) {
        if (
          replayed.entryKind !== moneyMovementKind.saleReceipt ||
          replayed.build?.uuid !== build.uuid
        )
          throw new createError.Conflict(
            "This request key belongs to a different money entry",
          );
        return FinanceFormatter.toMovement(replayed);
      }
      if (build.totalPrice === null || build.currencyCode === null)
        throw new createError.UnprocessableEntity(
          "This sale has no recorded price and cannot receive a payment",
        );
      const currencyCode = await FinanceService.currency(db, organizationId);
      if (currencyCode !== build.currencyCode)
        throw new createError.UnprocessableEntity(
          `This sale is recorded in ${build.currencyCode}, but this organization records money in ${currencyCode}`,
        );
      const amount = FinanceService.money(body.amount);
      const collected = await FinanceService.collected(
        db,
        organizationId,
        build.id,
      );
      const outstanding = build.totalPrice.minus(collected);
      if (amount.gt(outstanding))
        throw new createError.UnprocessableEntity(
          `The receipt exceeds the outstanding amount of ${outstanding.toString()}`,
        );
      const created = await db.moneyMovement.create({
        data: {
          organizationId,
          entryKind: moneyMovementKind.saleReceipt,
          currencyCode,
          amount,
          occurredAt: FinanceService.day(body.date),
          note: body.note?.trim() ?? "",
          requestKey,
          buildId: build.id,
          createdById: actor.userId,
        },
        select: movementSelect,
      });
      return FinanceFormatter.toMovement(created);
    });
  }

  /** Exactly the recorded cash collected for one sale, reversals included. */
  static async collected(
    db: Database,
    organizationId: string,
    buildId: number,
  ): Promise<Prisma.Decimal> {
    const sum = await db.moneyMovement.aggregate({
      where: {
        organizationId,
        buildId,
        entryKind: {
          in: [moneyMovementKind.saleReceipt, moneyMovementKind.reversal],
        },
      },
      _sum: { amount: true },
    });
    return sum._sum.amount ?? new Decimal(0);
  }

  static async supplier(
    db: Database,
    organizationId: string,
    uuid: string,
  ): Promise<{ id: number; uuid: string; name: string }> {
    const supplier = await db.supplier.findFirst({
      where: { organizationId, uuid },
      select: { id: true, uuid: true, name: true },
    });
    if (!supplier) throw new createError.NotFound("Supplier was not found");
    return supplier;
  }

  /**
   * The one purchase row of an order, created with the order itself. A read
   * never creates it: `null` means a historical order that predates the
   * reservation lifecycle and receives it on its next priced write.
   */
  static async purchaseHold(
    db: Database,
    organizationId: string,
    purchaseOrderId: number,
  ): Promise<{ id: number; currencyCode: string; status: number } | null> {
    return db.moneyMovement.findFirst({
      where: {
        organizationId,
        purchaseOrderId,
        entryKind: moneyMovementKind.purchase,
      },
      select: { id: true, currencyCode: true, status: true },
    });
  }

  /**
   * Creates or refreshes the on-hold reservation of one purchase order inside
   * the order transaction. The amount is the known priced subtotal and stays
   * negative: it reserves an outflow without posting it. A row that is already
   * posted or cancelled is financial history and is never rewritten here.
   *
   * There is exactly one reservation per organization+purchase order no matter
   * how many branch receipts split the delivery: a receipt is stock evidence,
   * never another company financial purchase. Callers must not call this once
   * per receipt or per destination branch.
   */
  static async savePurchaseHold(
    db: Prisma.TransactionClient,
    actor: TenantActor,
    input: {
      purchaseOrderId: number;
      purchaseOrderReference: string;
      supplierId: number | null;
      currencyCode: string;
      amount: Prisma.Decimal;
      pricingIncomplete: boolean;
      pricingIssueCount: number;
    },
  ): Promise<void> {
    const organizationId = actor.organizationId;
    const existing = await FinanceService.purchaseHold(
      db,
      organizationId,
      input.purchaseOrderId,
    );
    if (existing !== null && existing.status !== movementStatus.onHold) return;
    await FinanceService.lock(db);
    const data = {
      organizationId,
      currencyCode: input.currencyCode,
      amount: input.amount.neg(),
      note: `Purchase order ${input.purchaseOrderReference}`,
      supplierId: input.supplierId,
      pricingIncomplete: input.pricingIncomplete,
      pricingIssueCount: input.pricingIssueCount,
    };
    if (existing === null) {
      await db.moneyMovement.create({
        data: {
          ...data,
          entryKind: moneyMovementKind.purchase,
          status: movementStatus.onHold,
          purchaseOrderId: input.purchaseOrderId,
          occurredAt: FinanceService.today(),
          createdById: actor.userId,
        },
        select: { uuid: true },
      });
      return;
    }
    await db.moneyMovement.update({
      where: { id: existing.id },
      data,
    });
  }

  /**
   * Releases the reservation of a cancelled order. The row keeps the amount it
   * reserved as history but leaves both the cash balance and the hold.
   */
  static async releasePurchaseHold(
    db: Prisma.TransactionClient,
    organizationId: string,
    purchaseOrderId: number,
  ): Promise<void> {
    await FinanceService.lock(db);
    await db.moneyMovement.updateMany({
      where: {
        organizationId,
        purchaseOrderId,
        entryKind: moneyMovementKind.purchase,
        status: movementStatus.onHold,
      },
      data: { status: movementStatus.cancelled },
    });
  }

  /**
   * Final post of one purchase order inside its completion transaction, which
   * already holds the order lock. The reservation becomes the exact negative
   * cash amount exactly once, and the retained purchase debit is settled by one
   * equal auto-posted payment credit so a newly completed purchase leaves no
   * unpaid amount. A zero total writes no supplier entry because no debt
   * exists, and a released reservation is never revived.
   */
  static async finalizePurchase(
    db: Prisma.TransactionClient,
    actor: TenantActor,
    input: {
      purchaseOrderId: number;
      purchaseOrderReference: string;
      supplierId: number;
      currencyCode: string;
      amount: Prisma.Decimal;
      occurredAt: Date;
    },
  ): Promise<void> {
    const organizationId = actor.organizationId;
    await FinanceService.lock(db);
    const existing = await FinanceService.purchaseHold(
      db,
      organizationId,
      input.purchaseOrderId,
    );
    if (existing !== null && existing.status === movementStatus.cancelled)
      throw new createError.Conflict(
        "The purchase reservation of this order was released and cannot be posted",
      );
    const data = {
      organizationId,
      status: movementStatus.posted,
      currencyCode: input.currencyCode,
      amount: input.amount.neg(),
      occurredAt: input.occurredAt,
      note: `Purchase order ${input.purchaseOrderReference}`,
      supplierId: input.supplierId,
      pricingIncomplete: false,
      pricingIssueCount: 0,
    };
    let movementId: number;
    if (existing === null) {
      const created = await db.moneyMovement.create({
        data: {
          ...data,
          entryKind: moneyMovementKind.purchase,
          purchaseOrderId: input.purchaseOrderId,
          createdById: actor.userId,
        },
        select: { id: true },
      });
      movementId = created.id;
    } else if (existing.status === movementStatus.onHold) {
      await db.moneyMovement.update({ where: { id: existing.id }, data });
      movementId = existing.id;
    } else {
      // Already posted: this order cannot complete twice, so nothing is posted.
      return;
    }
    if (input.amount.isZero()) return;
    const note = `Purchase order ${input.purchaseOrderReference}`;
    const debit = await db.supplierLedgerEntry.findFirst({
      where: {
        organizationId,
        purchaseOrderId: input.purchaseOrderId,
        entryKind: supplierLedgerKind.purchase,
      },
      select: { id: true },
    });
    if (debit === null)
      await db.supplierLedgerEntry.create({
        data: {
          organizationId,
          supplierId: input.supplierId,
          entryKind: supplierLedgerKind.purchase,
          currencyCode: input.currencyCode,
          amount: input.amount,
          occurredAt: input.occurredAt,
          note,
          purchaseOrderId: input.purchaseOrderId,
          createdById: actor.userId,
        },
        select: { uuid: true },
      });
    // The credit is the payable side of this one cash movement, so the generic
    // reversal finds it through the movement's unique ledger link.
    const settled = await db.supplierLedgerEntry.findFirst({
      where: {
        organizationId,
        purchaseOrderId: input.purchaseOrderId,
        entryKind: supplierLedgerKind.payment,
      },
      select: { id: true },
    });
    if (settled === null)
      await db.supplierLedgerEntry.create({
        data: {
          organizationId,
          supplierId: input.supplierId,
          entryKind: supplierLedgerKind.payment,
          currencyCode: input.currencyCode,
          amount: input.amount.neg(),
          occurredAt: input.occurredAt,
          note: `${note} settled at completion`,
          purchaseOrderId: input.purchaseOrderId,
          moneyMovementId: movementId,
          createdById: actor.userId,
        },
        select: { uuid: true },
      });
  }

  /**
   * Reverses one posted entry at most once. The immutable original stays; the
   * linked reversal carries the negated amount. A supplier payment reverses
   * both its cash outflow and its debt reduction atomically; a posted purchase
   * restores its cash and reverses its auto-posted settlement credit, while the
   * purchase debit and the order's recorded prices stay untouched.
   */
  static async reverse(
    actor: TenantActor,
    uuid: string,
  ): Promise<FinanceModel["movement"]> {
    const organizationId = actor.organizationId;
    return FinanceService.write(async (db) => {
      const movement = await db.moneyMovement.findFirst({
        where: { organizationId, uuid },
        select: {
          ...movementSelect,
          supplierEntry: {
            select: {
              id: true,
              supplierId: true,
              entryKind: true,
              amount: true,
              note: true,
            },
          },
        },
      });
      if (!movement)
        throw new createError.NotFound("Money movement was not found");
      if (movement.reversalOf !== null)
        throw new createError.Conflict("A reversal entry cannot be reversed");
      if (movement.reversal !== null)
        throw new createError.Conflict(
          "This money movement has already been reversed",
        );
      if (movement.status !== movementStatus.posted)
        throw new createError.Conflict(
          movement.status === movementStatus.onHold
            ? "An on-hold purchase reservation is not cash; complete or cancel the purchase order instead"
            : "A cancelled purchase reservation has no cash to reverse",
        );
      if (movement.amount.isZero())
        throw new createError.Conflict(
          "This entry has no cash amount, so there is nothing to reverse",
        );
      const ledger = movement.supplierEntry;
      // A supplier payment and a posted purchase both own exactly one payable
      // credit on this movement; reversing the movement must reverse that credit.
      const settled =
        movement.entryKind === moneyMovementKind.supplierPayment ||
        movement.entryKind === moneyMovementKind.purchase;
      if (
        settled &&
        (ledger === null || ledger.entryKind !== supplierLedgerKind.payment)
      )
        throw new createError.InternalServerError(
          movement.entryKind === moneyMovementKind.purchase
            ? "Purchase settlement credit is missing"
            : "Supplier payment reversal is inconsistent",
        );
      const occurredAt = FinanceService.today();
      const reversal = await db.moneyMovement.create({
        data: {
          organizationId,
          entryKind: moneyMovementKind.reversal,
          currencyCode: movement.currencyCode,
          amount: movement.amount.neg(),
          occurredAt,
          note: movement.note,
          reversalOfId: movement.id,
          buildId: movement.buildId,
          supplierId: movement.supplierId,
          purchaseOrderId: movement.purchaseOrderId,
          createdById: actor.userId,
        },
        select: movementSelect,
      });
      if (settled && ledger) {
        await db.supplierLedgerEntry.create({
          data: {
            organizationId,
            supplierId: ledger.supplierId,
            entryKind: supplierLedgerKind.reversal,
            currencyCode: movement.currencyCode,
            amount: ledger.amount.neg(),
            occurredAt,
            note: ledger.note,
            reversalOfId: ledger.id,
            purchaseOrderId: movement.purchaseOrderId,
            moneyMovementId: reversal.id,
            createdById: actor.userId,
          },
          select: { uuid: true },
        });
      }
      return FinanceFormatter.toMovement(reversal);
    });
  }
}
