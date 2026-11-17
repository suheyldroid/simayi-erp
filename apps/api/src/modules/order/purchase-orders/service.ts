import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { Decimal, decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { BranchesService } from "@/modules/branches/service";
import { movementStatus } from "../../finance/model";
import { FinanceService } from "../../finance/service";
import { SupplierService } from "../../supplier/service";
import { OrderService } from "../service";
import { PurchaseOrdersFormatter } from "./formatter";
import {
  purchaseOrderSelect,
  purchaseOrderStatuses,
  type PurchaseOrdersDatabase,
  type PurchaseOrdersModel,
  type PurchaseOrdersRecord,
} from "./model";

const open = new Set([10, 20, 25]);

export abstract class PurchaseOrdersService {
  static flag(
    value: boolean | "true" | "false" | undefined,
  ): boolean | undefined {
    if (value === undefined) return undefined;
    return value === true || value === "true";
  }

  static assertOpen(order: { status: number }): void {
    if (!open.has(order.status))
      throw new createError.UnprocessableEntity(
        "Completed and cancelled orders are read-only",
      );
  }

  /**
   * Branch lifecycle locks come first (deterministic branch order), then the
   * purchase order lock. Callers pass every branch whose balance or lifecycle
   * this write depends on; stale/deactivated branches fail before any write.
   */
  static async write<T>(
    organizationId: string,
    branchUuids: readonly (string | null | undefined)[],
    run: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(
      async (db) => {
        const branches = [
          ...new Set(
            branchUuids.filter((uuid): uuid is string => uuid != null),
          ),
        ].sort();
        for (const branchUuid of branches)
          await BranchesService.requireByUuid(db, organizationId, branchUuid, {
            active: true,
            lock: "shared",
          });
        // pg_advisory_xact_lock returns void; execute it without a result row.
        await db.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(814206::bigint)`,
        );
        return run(db);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Integer-internal lookup scoped to the actor organization. */
  static async load(
    db: PurchaseOrdersDatabase,
    organizationId: string,
    id: number,
  ): Promise<PurchaseOrdersRecord> {
    const row = await db.purchaseOrder.findUnique({
      where: { organizationId_id: { organizationId, id: id } },
      select: purchaseOrderSelect,
    });
    if (!row) throw new createError.NotFound("Purchase order was not found");
    return row;
  }

  /** Public UUID boundary; cross-organization UUIDs stay invisible. */
  static async resolve(
    db: PurchaseOrdersDatabase,
    organizationId: string,
    uuid: string,
  ): Promise<PurchaseOrdersRecord> {
    const row = await db.purchaseOrder.findFirst({
      where: { organizationId, uuid },
      select: purchaseOrderSelect,
    });
    if (!row) throw new createError.NotFound("Purchase order was not found");
    return row;
  }

  static async claim(
    db: Prisma.TransactionClient,
    organizationId: string,
    id: number,
    version: number,
    data: Prisma.PurchaseOrderUncheckedUpdateManyInput,
  ): Promise<void> {
    const saved = await db.purchaseOrder.updateMany({
      where: { organizationId, id, version },
      data: {
        organizationId,
        ...data,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    if (saved.count !== 1)
      throw new createError.Conflict(
        "The purchase order was changed. Reload and retry.",
      );
  }

  static async supplier(
    db: PurchaseOrdersDatabase,
    organizationId: string,
    uuid: string,
  ) {
    return SupplierService.loadByUuid(db, organizationId, uuid);
  }

  static async responsible(
    db: PurchaseOrdersDatabase,
    organizationId: string,
    uuid: string | null | undefined,
  ) {
    if (uuid == null) return null;
    const owner = await db.owner.findFirst({
      where: { organizationId, uuid },
      select: { id: true },
    });
    if (!owner) throw new createError.NotFound("Owner was not found");
    return owner;
  }

  /**
   * Exact order total from the current item and extra lines. A missing price
   * is counted separately so completion can reject it, and a zero price stays
   * a real zero instead of being confused with a missing price. Priced lines
   * only total when every one of them records the same currency; a legacy line
   * without a currency or a mix of currencies has no single honest total.
   *
   * With `holdCurrency`, the same pass also yields the reservation: only amounts
   * already recorded in that one code are summed, and every other line (no
   * price, no currency, another currency) is counted instead of being treated
   * as zero or added across currencies.
   */
  static async totals(
    db: Prisma.TransactionClient,
    organizationId: string,
    orderId: number,
    holdCurrency: string | null = null,
  ): Promise<{
    total: Prisma.Decimal | null;
    currencyCode: string | null;
    pricedCount: number;
    missingPriceCount: number;
    unknownCurrencyCount: number;
    mixedCurrency: boolean;
    lineCount: number;
    hold: {
      amount: Prisma.Decimal;
      pricingIncomplete: boolean;
      pricingIssueCount: number;
    } | null;
  }> {
    const lines = await db.purchaseOrderLineItem.findMany({
      where: { organizationId, orderId },
      select: {
        quantity: true,
        purchasePrice: true,
        discount: true,
        currencyCode: true,
      },
    });
    const extras = await db.purchaseOrderExtraLine.findMany({
      where: { organizationId, orderId },
      select: {
        quantity: true,
        price: true,
        discount: true,
        currencyCode: true,
      },
    });
    const amounts = new Map<string, Prisma.Decimal>();
    let holdAmount = new Decimal(0);
    let holdIssueCount = 0;
    let pricedCount = 0;
    let missingPriceCount = 0;
    let unknownCurrencyCount = 0;
    const add = (
      quantity: Prisma.Decimal,
      price: Prisma.Decimal | null,
      discount: Prisma.Decimal,
      currencyCode: string | null,
    ) => {
      if (price == null) {
        missingPriceCount += 1;
        if (holdCurrency !== null) holdIssueCount += 1;
        return;
      }
      pricedCount += 1;
      if (currencyCode == null) {
        unknownCurrencyCount += 1;
        if (holdCurrency !== null) holdIssueCount += 1;
        return;
      }
      const amount = quantity
        .mul(price)
        .mul(new Decimal(1).minus(discount.div(100)));
      amounts.set(
        currencyCode,
        (amounts.get(currencyCode) ?? new Decimal(0)).plus(amount),
      );
      if (holdCurrency === null) return;
      if (currencyCode === holdCurrency) holdAmount = holdAmount.plus(amount);
      else holdIssueCount += 1;
    };
    for (const line of lines)
      add(line.quantity, line.purchasePrice, line.discount, line.currencyCode);
    for (const extra of extras)
      add(extra.quantity, extra.price, extra.discount, extra.currencyCode);
    const mixedCurrency = amounts.size > 1;
    const single =
      pricedCount > 0 && unknownCurrencyCount === 0 && amounts.size === 1
        ? [...amounts.entries()][0]
        : null;
    const lineCount = lines.length + extras.length;
    return {
      total: single ? single[1].toDecimalPlaces(6) : null,
      currencyCode: single ? single[0] : null,
      pricedCount,
      missingPriceCount,
      unknownCurrencyCount,
      mixedCurrency,
      lineCount,
      hold:
        holdCurrency === null
          ? null
          : {
              amount: holdAmount.toDecimalPlaces(6),
              // An empty order holds nothing yet, so its zero is pending rather
              // than a confirmed cost.
              pricingIncomplete: lineCount === 0 || holdIssueCount > 0,
              pricingIssueCount: holdIssueCount,
            },
    };
  }

  /**
   * Reservation currency of one order. A posted or cancelled reservation is
   * final, so no finance write happens for it; a legacy open order without a
   * row creates one from the fixed system currency on its next write.
   */
  private static async reservationCurrency(
    db: Prisma.TransactionClient,
    actor: TenantActor,
    order: PurchaseOrdersRecord,
  ): Promise<string | null> {
    if (!open.has(order.status)) return null;
    const hold = await FinanceService.purchaseHold(
      db,
      actor.organizationId,
      order.id,
    );
    if (hold !== null && hold.status !== movementStatus.onHold) return null;
    if (hold !== null) return hold.currencyCode;
    return FinanceService.currency(db, actor.organizationId);
  }

  /**
   * Recomputes the stored total, then refreshes the finance reservation of an
   * open order in the same transaction. The caller already holds the order lock,
   * so the finance lock stays last.
   */
  static async recalculate(
    db: Prisma.TransactionClient,
    actor: TenantActor,
    orderId: number,
  ): Promise<void> {
    const organizationId = actor.organizationId;
    const order = await PurchaseOrdersService.load(db, organizationId, orderId);
    const currencyCode = await PurchaseOrdersService.reservationCurrency(
      db,
      actor,
      order,
    );
    const totals = await PurchaseOrdersService.totals(
      db,
      organizationId,
      orderId,
      currencyCode,
    );
    const rounded = totals.total === null ? null : totals.total.toFixed(6);
    if (rounded) decimal(rounded, 6, 13);
    // The reservation is stored in DECIMAL(19,6) as well. A known subtotal that
    // does not fit is rejected here instead of failing inside the insert.
    if (totals.hold !== null) decimal(totals.hold.amount.toFixed(6), 6, 13);
    await db.purchaseOrder.update({
      where: { organizationId_id: { organizationId, id: orderId } },
      data: { organizationId, totalPrice: rounded },
    });
    if (currencyCode === null || totals.hold === null) return;
    await FinanceService.savePurchaseHold(db, actor, {
      purchaseOrderId: order.id,
      purchaseOrderReference: order.reference,
      supplierId: order.supplierId,
      currencyCode,
      amount: totals.hold.amount,
      pricingIncomplete: totals.hold.pricingIncomplete,
      pricingIssueCount: totals.hold.pricingIssueCount,
    });
  }

  private static async apply<T>(
    db: Prisma.TransactionClient,
    organizationId: string,
    order: PurchaseOrdersRecord,
    version: number,
    run: (
      db: Prisma.TransactionClient,
      order: PurchaseOrdersRecord,
    ) => Promise<T>,
  ): Promise<T> {
    PurchaseOrdersService.assertOpen(order);
    await PurchaseOrdersService.claim(
      db,
      organizationId,
      order.id,
      version,
      {},
    );
    return run(db, order);
  }

  /** Public UUID boundary for version-claiming writes. */
  static async changeUuid<T>(
    actor: TenantActor,
    uuid: string,
    version: number,
    run: (
      db: Prisma.TransactionClient,
      order: PurchaseOrdersRecord,
    ) => Promise<T>,
    branchUuids: readonly (string | null | undefined)[] = [],
  ): Promise<T> {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.write(
      organizationId,
      branchUuids,
      async (db) =>
        PurchaseOrdersService.apply(
          db,
          organizationId,
          await PurchaseOrdersService.resolve(db, organizationId, uuid),
          version,
          run,
        ),
    );
  }

  static async index(
    actor: TenantActor,
    query: PurchaseOrdersModel["query"],
  ): Promise<PurchaseOrdersModel["list"]> {
    const organizationId = actor.organizationId;
    if (query.status !== undefined && !purchaseOrderStatuses.has(query.status))
      throw new createError.UnprocessableEntity(
        "Unknown purchase order status",
      );
    const isOpen = PurchaseOrdersService.flag(query.open);
    // Company mode (no branch context) sees every origin. A branch context
    // lists only orders that originated there unless the caller names an
    // explicit origin or asks for company-origin orders.
    const company = PurchaseOrdersService.flag(query.company);
    let origin: number | null | undefined;
    if (query.branchUuid !== undefined)
      origin = (
        await BranchesService.requireByUuid(
          prisma,
          organizationId,
          query.branchUuid,
          { active: false },
        )
      ).id;
    else if (company === true) origin = null;
    else if (actor.branchId !== null) origin = actor.branchId;
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      AND: [
        origin === undefined ? {} : { branchId: origin },
        query.supplierUuid === undefined
          ? {}
          : { supplier: { is: { organizationId, uuid: query.supplierUuid } } },
        query.status === undefined ? {} : { status: query.status },
        isOpen ? { status: { in: [...open] } } : {},
        query.search
          ? {
              OR: [
                { reference: { contains: query.search, mode: "insensitive" } },
                {
                  supplierReference: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
                {
                  description: { contains: query.search, mode: "insensitive" },
                },
                {
                  supplier: {
                    organizationId,
                    name: { contains: query.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        select: purchaseOrderSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return {
      items: rows.map((row) => PurchaseOrdersFormatter.toOrder(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<PurchaseOrdersModel["order"]> {
    const organizationId = actor.organizationId;
    return PurchaseOrdersFormatter.toOrder(
      await PurchaseOrdersService.resolve(prisma, organizationId, uuid),
    );
  }

  static async store(actor: TenantActor, body: PurchaseOrdersModel["body"]) {
    const organizationId = actor.organizationId;
    // Omitted origin follows the caller's selected branch; an explicit null
    // always creates a company-origin order, even from a branch context.
    const originUuid =
      body.branchUuid === undefined ? actor.branchUuid : body.branchUuid;
    return PurchaseOrdersService.write(
      organizationId,
      [originUuid],
      async (db) => {
        const branchId =
          originUuid === null
            ? null
            : (
                await BranchesService.requireByUuid(
                  db,
                  organizationId,
                  originUuid,
                  { active: true, lock: "none" },
                )
              ).id;
        const supplier = await PurchaseOrdersService.supplier(
          db,
          organizationId,
          body.supplierUuid,
        );
        const responsible = await PurchaseOrdersService.responsible(
          db,
          organizationId,
          body.responsibleUuid,
        );
        const reference = await OrderService.reference(
          "PURCHASEORDER_REFERENCE_PATTERN",
          body.reference,
          async () =>
            (
              await db.purchaseOrder.aggregate({
                where: { organizationId },
                _max: { referenceInt: true },
              })
            )._max.referenceInt ?? 0n,
          async (value) =>
            (await db.purchaseOrder.findUnique({
              where: {
                organizationId_reference: { organizationId, reference: value },
              },
              select: { id: true },
            })) != null,
        );
        const barcode = CatalogService.barcode(body.barcodeData ?? "");
        const created = await db.purchaseOrder.create({
          data: {
            organizationId,
            reference: reference.reference,
            referenceInt: reference.referenceInt,
            description: body.description?.trim() ?? "",
            link: body.link?.trim() ?? "",
            supplierReference: body.supplierReference?.trim() ?? "",
            supplierId: supplier.id,
            branchId,
            responsibleId: responsible?.id ?? null,
            startDate: OrderService.optionalDay(body.startDate) ?? null,
            targetDate: OrderService.optionalDay(body.targetDate) ?? null,
            creationDate: OrderService.today(),
            createdById: actor.userId,
            updatedAt: new Date(),
            barcodeData: barcode.barcodeData,
            barcodeHash: barcode.barcodeHash,
            status: 10,
          },
          select: purchaseOrderSelect,
        });
        // The order and its reservation are one transaction: the finance record
        // exists from creation, holds zero until priced lines appear, and is
        // flagged as pending pricing meanwhile.
        await PurchaseOrdersService.recalculate(db, actor, created.id);
        return PurchaseOrdersFormatter.toOrder(created);
      },
    );
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: PurchaseOrdersModel["patch"],
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.changeUuid(
      actor,
      uuid,
      body.version,
      async (db, existing) => {
        // Origin is a commercial fact: it may only change while the order is
        // still a draft and no delivery event exists.
        let origin: number | null | undefined;
        if (body.branchUuid !== undefined) {
          const current = existing.branch?.uuid ?? null;
          if (body.branchUuid !== current) {
            if (existing.status !== 10)
              throw new createError.UnprocessableEntity(
                "The purchase origin cannot change after the order became operational",
              );
            const [events, received] = await Promise.all([
              db.purchaseReceipt.count({
                where: { organizationId, orderId: existing.id },
              }),
              db.purchaseOrderLineItem.count({
                where: {
                  organizationId,
                  orderId: existing.id,
                  received: { gt: new Prisma.Decimal(0) },
                },
              }),
            ]);
            if (events > 0 || received > 0)
              throw new createError.UnprocessableEntity(
                "The purchase origin cannot change after stock was received",
              );
            origin =
              body.branchUuid === null
                ? null
                : (
                    await BranchesService.requireByUuid(
                      db,
                      organizationId,
                      body.branchUuid,
                      { active: true, lock: "none" },
                    )
                  ).id;
          }
        }
        // PostgreSQL uuid columns canonicalize to lowercase; normalize the
        // input before change detection so casing alone is not a change.
        const supplierUuid =
          body.supplierUuid === undefined
            ? undefined
            : body.supplierUuid.toLowerCase();
        const supplierChanged =
          supplierUuid !== undefined &&
          supplierUuid !== (existing.supplier?.uuid ?? null);
        if (
          supplierChanged &&
          (await db.purchaseOrderLineItem.count({
            where: { organizationId, orderId: existing.id },
          })) > 0
        )
          throw new createError.UnprocessableEntity(
            "Supplier cannot change after lines are added",
          );
        const supplier =
          supplierUuid === undefined
            ? null
            : await PurchaseOrdersService.supplier(
                db,
                organizationId,
                supplierUuid,
              );
        const responsible =
          body.responsibleUuid === undefined
            ? undefined
            : await PurchaseOrdersService.responsible(
                db,
                organizationId,
                body.responsibleUuid,
              );
        const barcode =
          body.barcodeData === undefined
            ? null
            : CatalogService.barcode(body.barcodeData);
        await db.purchaseOrder.update({
          where: {
            organizationId_id: { organizationId, id: existing.id },
          },
          data: {
            organizationId,
            ...(origin === undefined ? {} : { branchId: origin }),
            ...(supplier === null ? {} : { supplierId: supplier.id }),
            ...(responsible === undefined
              ? {}
              : { responsibleId: responsible?.id ?? null }),
            ...(body.description === undefined
              ? {}
              : { description: body.description.trim() }),
            ...(body.link === undefined ? {} : { link: body.link.trim() }),
            ...(body.supplierReference === undefined
              ? {}
              : { supplierReference: body.supplierReference.trim() }),
            ...(body.startDate === undefined
              ? {}
              : { startDate: OrderService.optionalDay(body.startDate) }),
            ...(body.targetDate === undefined
              ? {}
              : { targetDate: OrderService.optionalDay(body.targetDate) }),
            ...(barcode
              ? {
                  barcodeData: barcode.barcodeData,
                  barcodeHash: barcode.barcodeHash,
                }
              : {}),
          },
        });
        // A header write can change the supplier metadata of the reservation,
        // so the same transaction refreshes it from the stored order.
        await PurchaseOrdersService.recalculate(db, actor, existing.id);
        return PurchaseOrdersFormatter.toOrder(
          await PurchaseOrdersService.load(db, organizationId, existing.id),
        );
      },
      body.branchUuid == null ? [] : [body.branchUuid],
    );
  }

  static async place(actor: TenantActor, uuid: string, version: number) {
    return PurchaseOrdersService.transition(actor, uuid, version, (order) => {
      if (order.status !== 10 && order.status !== 25)
        throw new createError.UnprocessableEntity(
          "Only pending or on-hold orders can be placed",
        );
      return {
        status: 20,
        ...(order.status === 10 || order.issueDate == null
          ? { issueDate: OrderService.today() }
          : {}),
      };
    });
  }

  static async hold(actor: TenantActor, uuid: string, version: number) {
    return PurchaseOrdersService.transition(actor, uuid, version, (order) => {
      if (order.status !== 10 && order.status !== 20)
        throw new createError.UnprocessableEntity(
          "Only pending or placed orders can be put on hold",
        );
      return { status: 25 };
    });
  }

  static async cancel(actor: TenantActor, uuid: string, version: number) {
    return PurchaseOrdersService.transition(actor, uuid, version, (order) => {
      PurchaseOrdersService.assertOpen(order);
      return { status: 40 };
    });
  }

  static async complete(
    actor: TenantActor,
    uuid: string,
    body: PurchaseOrdersModel["completeBody"],
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.write(organizationId, [], async (db) => {
      const order = await PurchaseOrdersService.resolve(
        db,
        organizationId,
        uuid,
      );
      if (order.status !== 20)
        throw new createError.UnprocessableEntity(
          "Only placed orders can be completed",
        );
      const lines = await db.purchaseOrderLineItem.findMany({
        where: { organizationId, orderId: order.id },
        select: { quantity: true, received: true },
      });
      if (
        lines.some((line) => line.received.lt(line.quantity)) &&
        body.acceptIncomplete !== true
      )
        throw new createError.UnprocessableEntity(
          "Some lines are not fully received",
        );
      // Completion is the only purchase transition that turns the reservation
      // into cash and creates the supplier payable, so the financial
      // requirements are validated here before the order changes state.
      const totals = await PurchaseOrdersService.totals(
        db,
        organizationId,
        order.id,
      );
      if (totals.lineCount === 0)
        throw new createError.UnprocessableEntity(
          "Add at least one item or extra line before completing this purchase order",
        );
      if (totals.missingPriceCount > 0)
        throw new createError.UnprocessableEntity(
          "Every purchase line and extra line must have a price before completion",
        );
      // Legacy lines can predate the per-line currency snapshot. Their amounts
      // are kept exactly as recorded and completion fails instead of assuming
      // a currency or summing codes that do not match.
      if (totals.unknownCurrencyCount > 0)
        throw new createError.UnprocessableEntity(
          "Every priced item and extra line must record its currency before completion",
        );
      if (totals.mixedCurrency)
        throw new createError.UnprocessableEntity(
          "This purchase order has lines in more than one currency and cannot be totaled; correct the lines before completion",
        );
      if (totals.total === null || totals.currencyCode === null)
        throw new createError.InternalServerError(
          "Purchase order total was not resolved",
        );
      const total = totals.total;
      const orderCurrency = totals.currencyCode;
      const supplierUuid = order.supplier?.uuid ?? null;
      if (supplierUuid === null)
        throw new createError.UnprocessableEntity(
          "Assign a supplier before completing this purchase order",
        );
      const supplier = await db.supplier.findFirst({
        where: { organizationId, uuid: supplierUuid },
        select: { id: true },
      });
      if (!supplier)
        throw new createError.UnprocessableEntity(
          "The purchase order supplier is not available in this organization",
        );
      const financeCurrency = await FinanceService.currency(db, organizationId);
      if (financeCurrency !== orderCurrency)
        throw new createError.UnprocessableEntity(
          `This purchase order is in ${orderCurrency}, but this organization records money in ${financeCurrency}`,
        );
      const completeDate = OrderService.today();
      await PurchaseOrdersService.claim(
        db,
        organizationId,
        order.id,
        body.version,
        {
          status: 30,
          completeDate,
          receivedById: actor.userId,
          totalPrice: total.toFixed(6),
        },
      );
      await FinanceService.finalizePurchase(db, actor, {
        purchaseOrderId: order.id,
        purchaseOrderReference: order.reference,
        supplierId: supplier.id,
        currencyCode: financeCurrency,
        amount: total,
        occurredAt: completeDate,
      });
      return PurchaseOrdersFormatter.toOrder(
        await PurchaseOrdersService.load(db, organizationId, order.id),
      );
    });
  }

  private static async transition(
    actor: TenantActor,
    uuid: string,
    version: number,
    data: (
      order: PurchaseOrdersRecord,
    ) => Prisma.PurchaseOrderUncheckedUpdateManyInput,
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.write(organizationId, [], async (db) => {
      const order = await PurchaseOrdersService.resolve(
        db,
        organizationId,
        uuid,
      );
      const patch = data(order);
      if (
        typeof patch.status !== "number" ||
        !purchaseOrderStatuses.has(patch.status)
      )
        throw new createError.InternalServerError(
          "Purchase order status was not resolved",
        );
      await PurchaseOrdersService.claim(
        db,
        organizationId,
        order.id,
        version,
        patch,
      );
      // Cancelling drops a reservation without ever touching cash; placing or
      // holding keeps it reserved until completion or cancellation.
      if (patch.status === 40)
        await FinanceService.releasePurchaseHold(db, organizationId, order.id);
      return PurchaseOrdersFormatter.toOrder(
        await PurchaseOrdersService.load(db, organizationId, order.id),
      );
    });
  }
}
