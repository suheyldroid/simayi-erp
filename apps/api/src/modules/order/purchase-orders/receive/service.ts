import { Prisma } from "../../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { Decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { BranchesService } from "@/modules/branches/service";
import { ItemStockService } from "../../../items/stock/service";
import { OrderService } from "../../service";
import { PurchaseOrdersService } from "../service";
import { ReceiptsFormatter } from "./formatter";
import { receiptSelect, type ReceiveModel } from "./model";

/** Tracking type of a compensating purchase receipt event. */
const reversalTrackingType = 71;

/** One validated receipt request row paired with its exact target movement. */
type PreparedReceipt = {
  lineUuid: string;
  destination: string;
  quantity: Prisma.Decimal;
  notes: string | null;
};

const reversalSelect = {
  id: true,
  uuid: true,
  branchId: true,
  lineId: true,
  itemId: true,
  itemUuid: true,
  quantity: true,
  stockQuantity: true,
  unitCode: true,
  packQuantityNative: true,
  purchasePrice: true,
  discount: true,
  currencyCode: true,
  legacyBaseline: true,
  requestKey: true,
  branch: { select: { uuid: true, active: true } },
  line: { select: { uuid: true } },
  reversalOf: { select: { uuid: true } },
  // The committed compensating event's internal replay key is needed to
  // answer identical correction retries; it is not part of the public DTO.
  reversal: { select: { ...receiptSelect, requestKey: true } },
} satisfies Prisma.PurchaseReceiptSelect;

export abstract class ReceiveService {
  static async receive(
    actor: TenantActor,
    orderUuid: string,
    body: ReceiveModel["body"],
  ): Promise<ReceiveModel["created"]> {
    const organizationId = actor.organizationId;
    // PostgreSQL canonicalizes UUID columns to lowercase; normalize the public
    // identities before duplicate detection and replay comparison so an
    // uppercase retry of the same request is still the same request.
    const lineUuids = body.items.map((entry) => entry.lineUuid.toLowerCase());
    if (new Set(lineUuids).size !== lineUuids.length)
      throw new createError.UnprocessableEntity(
        "Each purchase line can appear only once per receipt request",
      );
    // A branch-origin order defaults each destination to its source branch; a
    // company-origin order has no physical origin and needs an explicit one.
    const existingOrder = await PurchaseOrdersService.resolve(
      prisma,
      organizationId,
      orderUuid,
    );
    const originUuid = existingOrder.branch?.uuid ?? null;
    const prepared: PreparedReceipt[] = body.items.map((entry) => {
      const destination = (entry.branchUuid ?? originUuid)?.toLowerCase();
      if (destination === undefined)
        throw new createError.UnprocessableEntity(
          "Every receipt entry needs a destination branch for a company-origin purchase order",
        );
      return {
        lineUuid: entry.lineUuid.toLowerCase(),
        destination,
        quantity: OrderService.quantity(entry.quantity),
        notes: ItemStockService.notes(entry.notes),
      };
    });
    const branchUuids = [...new Set(prepared.map((row) => row.destination))];
    // A committed request is immutable and replayable regardless of later
    // order status, branch deactivation or a stale version, so replay is
    // resolved before any branch lifecycle guard is required.
    const replay = await ReceiveService.replay(
      prisma,
      organizationId,
      existingOrder,
      body.requestKey,
      prepared,
    );
    if (replay !== null) return replay;
    return PurchaseOrdersService.write(
      organizationId,
      branchUuids,
      async (db) => {
        const order = await PurchaseOrdersService.resolve(
          db,
          organizationId,
          orderUuid,
        );
        // Re-check inside the transaction: a concurrent first commit with the
        // same key wins before this transaction mutates anything.
        const committed = await ReceiveService.replay(
          db,
          organizationId,
          order,
          body.requestKey,
          prepared,
        );
        if (committed !== null) return committed;
        if (order.status !== 20)
          throw new createError.UnprocessableEntity(
            "Only placed orders can be received",
          );
        await PurchaseOrdersService.claim(
          db,
          organizationId,
          order.id,
          body.version,
          {},
        );
        await ItemStockService.lock(db);
        const branches = new Map<string, number>();
        for (const branchUuid of branchUuids) {
          const branch = await BranchesService.requireByUuid(
            db,
            organizationId,
            branchUuid,
            { active: true, lock: "none" },
          );
          branches.set(branchUuid, branch.id);
        }
        for (const request of prepared) {
          const line = await db.purchaseOrderLineItem.findFirst({
            where: {
              organizationId,
              uuid: request.lineUuid,
              orderId: order.id,
            },
            select: {
              id: true,
              uuid: true,
              quantity: true,
              received: true,
              packQuantityNative: true,
              unitCode: true,
              purchasePrice: true,
              discount: true,
              currencyCode: true,
              item: { select: { id: true, uuid: true } },
            },
          });
          if (!line)
            throw new createError.NotFound("Purchase order line was not found");
          if (!line.item)
            throw new createError.UnprocessableEntity("Line has no item");
          const quantity = request.quantity;
          if (quantity.gt(line.quantity.minus(line.received)))
            throw new createError.UnprocessableEntity(
              "Receive quantity exceeds the outstanding quantity",
            );
          const pack = line.packQuantityNative ?? new Decimal(1);
          if (pack.lte(0))
            throw new createError.UnprocessableEntity(
              "Line pack quantity must be greater than zero",
            );
          const stockQty = quantity.mul(pack);
          if (
            stockQty.lte(0) ||
            stockQty.decimalPlaces() > 5 ||
            stockQty.gte(new Decimal(10).pow(15))
          )
            throw new createError.UnprocessableEntity(
              "Stock quantity exceeds the supported precision",
            );
          const destinationUuid = request.destination;
          const branchId = branches.get(destinationUuid);
          if (branchId === undefined)
            throw new createError.InternalServerError(
              "Receipt destination branch was not resolved",
            );
          await ItemStockService.change(
            db,
            {
              organizationId,
              branchId,
              branchUuid: destinationUuid,
              userId: actor.userId,
            },
            line.item.id,
            "add",
            stockQty,
            {
              trackingType: 70,
              notes: request.notes,
              deltas: {
                purchaseOrderUuid: order.uuid,
                lineUuid: line.uuid,
                quantity: quantity.toString(),
                requestKey: body.requestKey,
              },
            },
          );
          await db.purchaseReceipt.create({
            data: {
              organizationId,
              orderId: order.id,
              lineId: line.id,
              branchId,
              itemId: line.item.id,
              itemUuid: line.item.uuid,
              quantity,
              stockQuantity: stockQty,
              unitCode: line.unitCode,
              packQuantityNative: line.packQuantityNative,
              purchasePrice: line.purchasePrice,
              discount: line.discount,
              currencyCode: line.currencyCode,
              notes: request.notes,
              userId: actor.userId,
              requestKey: body.requestKey,
            },
          });
          await db.purchaseOrderLineItem.update({
            where: { organizationId_id: { organizationId, id: line.id } },
            data: { organizationId, received: line.received.plus(quantity) },
          });
        }
        const created = await db.purchaseReceipt.findMany({
          where: {
            organizationId,
            orderId: order.id,
            requestKey: body.requestKey,
          },
          select: receiptSelect,
          orderBy: { id: "asc" },
        });
        return {
          orderVersion: order.version + 1,
          receipts: created.map((row) => ReceiptsFormatter.toReceipt(row)),
        };
      },
    );
  }

  /**
   * Immutable replay of one request key. The committed events must match the
   * caller's exact intent: one event per requested line, the same destination
   * branch per line, the same normalized order quantity and the same notes.
   */
  private static async replay(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    order: { uuid: string; version: number },
    requestKey: string,
    requests: readonly PreparedReceipt[],
  ): Promise<ReceiveModel["created"] | null> {
    const rows = await db.purchaseReceipt.findMany({
      where: { organizationId, requestKey },
      select: receiptSelect,
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) return null;
    const mismatch = () =>
      new createError.Conflict(
        "This receipt request key was already used for a different delivery",
      );
    if (rows.length !== requests.length) throw mismatch();
    const byLine = new Map(rows.map((row) => [row.line.uuid, row]));
    if (byLine.size !== rows.length) throw mismatch();
    for (const request of requests) {
      const row = byLine.get(request.lineUuid);
      if (!row || row.order.uuid !== order.uuid) throw mismatch();
      if (row.branch.uuid !== request.destination) throw mismatch();
      if (!row.quantity.equals(request.quantity)) throw mismatch();
      if (row.notes !== request.notes) throw mismatch();
    }
    return {
      orderVersion: order.version,
      receipts: rows.map((row) => ReceiptsFormatter.toReceipt(row)),
    };
  }

  static async index(
    actor: TenantActor,
    orderUuid: string,
    query: ReceiveModel["query"],
  ): Promise<ReceiveModel["list"]> {
    const organizationId = actor.organizationId;
    const order = await PurchaseOrdersService.resolve(
      prisma,
      organizationId,
      orderUuid,
    );
    const where: Prisma.PurchaseReceiptWhereInput = {
      organizationId,
      orderId: order.id,
    };
    if (query.lineUuid !== undefined) {
      const line = await prisma.purchaseOrderLineItem.findFirst({
        where: { organizationId, orderId: order.id, uuid: query.lineUuid },
        select: { id: true },
      });
      if (!line)
        throw new createError.NotFound("Purchase order line was not found");
      where.lineId = line.id;
    }
    if (query.branchUuid !== undefined)
      where.branchId = (
        await BranchesService.requireByUuid(
          prisma,
          organizationId,
          query.branchUuid,
          { active: false },
        )
      ).id;
    const [rows, total] = await prisma.$transaction([
      prisma.purchaseReceipt.findMany({
        where,
        select: receiptSelect,
        orderBy: [{ id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.purchaseReceipt.count({ where }),
    ]);
    return {
      items: rows.map((row) => ReceiptsFormatter.toReceipt(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async reverse(
    actor: TenantActor,
    orderUuid: string,
    receiptUuid: string,
    body: ReceiveModel["reverseBody"],
  ): Promise<ReceiveModel["reversed"]> {
    const organizationId = actor.organizationId;
    const order = await PurchaseOrdersService.resolve(
      prisma,
      organizationId,
      orderUuid,
    );
    // An already committed correction is immutable history: return it before
    // requiring an active destination, a placed order or a fresh version.
    const known = await prisma.purchaseReceipt.findFirst({
      where: { organizationId, orderId: order.id, uuid: receiptUuid },
      select: reversalSelect,
    });
    if (!known)
      throw new createError.NotFound("Purchase receipt was not found");
    const knownKey = body.requestKey ?? `reversal:${known.uuid}`;
    if (known.reversalOf !== null)
      throw new createError.Conflict(
        "A compensating receipt event cannot be reversed",
      );
    if (known.reversal !== null) {
      if (known.reversal.requestKey === knownKey)
        return {
          orderVersion: order.version,
          receipt: ReceiptsFormatter.toReceipt(known.reversal),
        };
      throw new createError.Conflict(
        "This purchase receipt was already corrected",
      );
    }
    // The destination branch is needed before the write transaction so its
    // lifecycle lock is acquired first, never after the order lock.
    return PurchaseOrdersService.write(
      organizationId,
      [known.branch.uuid],
      async (db) => {
        const order = await PurchaseOrdersService.resolve(
          db,
          organizationId,
          orderUuid,
        );
        const receipt = await db.purchaseReceipt.findFirst({
          where: { organizationId, orderId: order.id, uuid: receiptUuid },
          select: reversalSelect,
        });
        if (!receipt)
          throw new createError.NotFound("Purchase receipt was not found");
        if (receipt.reversalOf !== null)
          throw new createError.Conflict(
            "A compensating receipt event cannot be reversed",
          );
        // Real receipt events require a non-null replay key in the database;
        // a deterministic key keeps retries idempotent without extra input.
        const reversalKey = body.requestKey ?? `reversal:${receipt.uuid}`;
        // Concurrent first-commit recheck before any mutation.
        if (receipt.reversal !== null) {
          if (receipt.reversal.requestKey === reversalKey)
            return {
              orderVersion: order.version,
              receipt: ReceiptsFormatter.toReceipt(receipt.reversal),
            };
          throw new createError.Conflict(
            "This purchase receipt was already corrected",
          );
        }
        // Finalized and cancelled orders never reopen for a physical
        // correction; replay above still returns an already committed event.
        if (order.status === 30)
          throw new createError.UnprocessableEntity(
            "Completed purchase orders are read-only; a physical correction cannot reopen them",
          );
        if (order.status !== 20)
          throw new createError.UnprocessableEntity(
            "Only placed orders can correct a receipt",
          );
        if (body.requestKey !== undefined) {
          const clash = await db.purchaseReceipt.findFirst({
            where: { organizationId, requestKey: body.requestKey },
            select: { id: true },
          });
          if (clash)
            throw new createError.Conflict(
              "This receipt request key was already used for another delivery",
            );
        }
        if (receipt.legacyBaseline || receipt.stockQuantity === null)
          throw new createError.UnprocessableEntity(
            "A legacy receipt baseline has no recorded stock movement to reverse",
          );
        if (receipt.itemId === null)
          throw new createError.UnprocessableEntity(
            "The receipt item no longer exists, so its stock cannot be corrected",
          );
        if (!receipt.branch.active)
          throw new createError.Conflict("The destination branch is inactive");
        const line = await db.purchaseOrderLineItem.findFirst({
          where: { organizationId, id: receipt.lineId, orderId: order.id },
          select: { id: true, received: true, quantity: true },
        });
        if (!line)
          throw new createError.NotFound("Purchase order line was not found");
        if (line.received.lt(receipt.quantity))
          throw new createError.Conflict(
            "The recorded received quantity does not support this correction",
          );
        const stockQuantity = receipt.stockQuantity;
        const itemId = receipt.itemId;
        await PurchaseOrdersService.claim(
          db,
          organizationId,
          order.id,
          body.version,
          {},
        );
        await ItemStockService.change(
          db,
          {
            organizationId,
            branchId: receipt.branchId,
            branchUuid: receipt.branch.uuid,
            userId: actor.userId,
          },
          itemId,
          "remove",
          stockQuantity,
          {
            trackingType: reversalTrackingType,
            notes: body.notes,
            deltas: {
              purchaseOrderUuid: order.uuid,
              lineUuid: receipt.line.uuid,
              receiptUuid: receipt.uuid,
              reversal: true,
            },
          },
        );
        await db.purchaseOrderLineItem.update({
          where: { organizationId_id: { organizationId, id: line.id } },
          data: {
            organizationId,
            received: line.received.minus(receipt.quantity),
          },
        });
        const created = await db.purchaseReceipt.create({
          data: {
            organizationId,
            orderId: order.id,
            lineId: receipt.lineId,
            branchId: receipt.branchId,
            itemId,
            itemUuid: receipt.itemUuid,
            // Compensating events store the negated movement, matching the
            // money-movement reversal precedent and the DB reversal trigger.
            quantity: receipt.quantity.negated(),
            stockQuantity: stockQuantity.negated(),
            unitCode: receipt.unitCode,
            packQuantityNative: receipt.packQuantityNative,
            purchasePrice: receipt.purchasePrice,
            discount: receipt.discount,
            currencyCode: receipt.currencyCode,
            notes: ItemStockService.notes(body.notes),
            userId: actor.userId,
            requestKey: reversalKey,
            reversalOfId: receipt.id,
          },
          select: { id: true },
        });
        const saved = await db.purchaseReceipt.findUnique({
          where: { id: created.id },
          select: receiptSelect,
        });
        if (!saved)
          throw new createError.InternalServerError(
            "Compensating receipt event was not saved",
          );
        return {
          orderVersion: order.version + 1,
          receipt: ReceiptsFormatter.toReceipt(saved),
        };
      },
    );
  }
}
