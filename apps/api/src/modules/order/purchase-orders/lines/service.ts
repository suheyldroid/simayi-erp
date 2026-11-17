import { Prisma } from "../../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { ItemStockService } from "../../../items/stock/service";
import { SystemPreferencesService } from "../../../system-preferences/service";
import { OrderService } from "../../service";
import { PurchaseOrdersService } from "../service";
import { LinesFormatter } from "./formatter";
import { lineSelect, type LinesModel } from "./model";

export abstract class LinesService {
  /**
   * Resolves the item of a new or changed line and freezes its current unit
   * code on the line. Callers hold the stock lock, so an item unit
   * reassignment cannot interleave with this read.
   */
  static async item(
    db: Prisma.TransactionClient,
    organizationId: string,
    uuid: string,
  ): Promise<{ id: number; unitCode: string }> {
    const row = await db.part.findFirst({
      where: { organizationId, uuid },
      select: { id: true, unit: { select: { code: true } } },
    });
    if (!row) throw new createError.NotFound("Item was not found");
    if (!row.unit)
      throw new createError.UnprocessableEntity(
        "Assign a unit to this item before adding it to a purchase order",
      );
    return { id: row.id, unitCode: row.unit.code };
  }

  static async index(
    actor: TenantActor,
    orderUuid: string,
    query: LinesModel["query"],
  ): Promise<LinesModel["list"]> {
    const organizationId = actor.organizationId;
    const order = await PurchaseOrdersService.resolve(
      prisma,
      organizationId,
      orderUuid,
    );
    const where = { organizationId, orderId: order.id };
    const [rows, total] = await prisma.$transaction([
      prisma.purchaseOrderLineItem.findMany({
        where,
        select: lineSelect,
        orderBy: [{ lineInt: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.purchaseOrderLineItem.count({ where }),
    ]);
    return {
      items: rows.map((row) => LinesFormatter.toLine(row, order.uuid)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async store(
    actor: TenantActor,
    orderUuid: string,
    body: LinesModel["body"],
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.changeUuid(
      actor,
      orderUuid,
      body.version,
      async (db, order) => {
        // Order lock is already held; the stock lock serializes item unit
        // reassignment with the snapshot read below.
        await ItemStockService.lock(db);
        const item = await LinesService.item(db, organizationId, body.itemUuid);
        const quantity = OrderService.quantity(body.quantity);
        const purchasePrice =
          body.purchasePrice === undefined || body.purchasePrice === null
            ? null
            : OrderService.money(body.purchasePrice);
        const numbered = OrderService.lineNumber(body.line);
        const currencyCode = await SystemPreferencesService.requireCurrency(db);
        const created = await db.purchaseOrderLineItem.create({
          data: {
            organizationId,
            orderId: order.id,
            itemId: item.id,
            unitCode: item.unitCode,
            currencyCode,
            quantity,
            received: 0,
            discount: OrderService.discount(body.discount),
            purchasePrice,
            line: numbered.line,
            lineInt: numbered.lineInt,
            reference: body.reference?.trim() ?? "",
            notes: body.notes?.trim() ?? "",
            link: body.link?.trim() ?? "",
            targetDate: OrderService.optionalDay(body.targetDate) ?? null,
          },
          select: lineSelect,
        });
        await PurchaseOrdersService.recalculate(db, actor, order.id);
        return LinesFormatter.toLine(created, order.uuid);
      },
    );
  }

  static async update(
    actor: TenantActor,
    orderUuid: string,
    lineUuid: string,
    body: LinesModel["patch"],
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.changeUuid(
      actor,
      orderUuid,
      body.version,
      async (db, order) => {
        // Order lock is held; the stock lock serializes item unit reassignment
        // with the line write below.
        await ItemStockService.lock(db);
        const existing = await db.purchaseOrderLineItem.findFirst({
          where: { organizationId, uuid: lineUuid, orderId: order.id },
          select: lineSelect,
        });
        if (!existing)
          throw new createError.NotFound("Purchase order line was not found");
        // PostgreSQL uuid columns canonicalize to lowercase; normalize the
        // input before change detection and reuse it for the same-org lookup.
        const requestedItemUuid =
          body.itemUuid === undefined ? undefined : body.itemUuid.toLowerCase();
        if (
          requestedItemUuid !== undefined &&
          requestedItemUuid !== (existing.item?.uuid ?? null) &&
          existing.received.gt(0)
        )
          throw new createError.UnprocessableEntity(
            "Received lines cannot change item",
          );
        const itemUuid = requestedItemUuid ?? existing.item?.uuid ?? null;
        if (itemUuid == null)
          throw new createError.UnprocessableEntity("Line has no item");
        const itemChanged =
          requestedItemUuid !== undefined &&
          requestedItemUuid !== (existing.item?.uuid ?? null);
        const item = itemChanged
          ? await LinesService.item(db, organizationId, itemUuid)
          : null;
        const quantity =
          body.quantity === undefined
            ? existing.quantity
            : OrderService.quantity(body.quantity);
        if (quantity.lt(existing.received))
          throw new createError.UnprocessableEntity(
            "Quantity cannot be lower than the received quantity",
          );
        const purchasePrice =
          body.purchasePrice === undefined
            ? existing.purchasePrice
            : body.purchasePrice === null
              ? null
              : OrderService.money(body.purchasePrice);
        // A newly written price is denominated in the fixed system currency.
        // Quantity, note and discount edits keep the stored snapshot untouched,
        // and an echoed equal amount is not a new price.
        const currencyCode =
          body.purchasePrice === undefined ||
          body.purchasePrice === null ||
          (existing.purchasePrice !== null &&
            purchasePrice !== null &&
            purchasePrice.equals(existing.purchasePrice))
            ? null
            : await SystemPreferencesService.requireCurrency(db);
        const numbered =
          body.line === undefined ? null : OrderService.lineNumber(body.line);
        const saved = await db.purchaseOrderLineItem.update({
          where: {
            organizationId_id: { organizationId, id: existing.id },
          },
          data: {
            organizationId,
            ...(item === null
              ? {}
              : {
                  itemId: item.id,
                  unitCode: item.unitCode,
                  packQuantityNative: new Prisma.Decimal(1),
                }),
            quantity,
            purchasePrice,
            ...(currencyCode === null ? {} : { currencyCode }),
            ...(body.discount === undefined
              ? {}
              : { discount: OrderService.discount(body.discount) }),
            ...(numbered
              ? { line: numbered.line, lineInt: numbered.lineInt }
              : {}),
            ...(body.reference === undefined
              ? {}
              : { reference: body.reference.trim() }),
            ...(body.notes === undefined ? {} : { notes: body.notes.trim() }),
            ...(body.link === undefined ? {} : { link: body.link.trim() }),
            ...(body.targetDate === undefined
              ? {}
              : { targetDate: OrderService.optionalDay(body.targetDate) }),
          },
          select: lineSelect,
        });
        await PurchaseOrdersService.recalculate(db, actor, order.id);
        return LinesFormatter.toLine(saved, order.uuid);
      },
    );
  }

  static async destroy(
    actor: TenantActor,
    orderUuid: string,
    lineUuid: string,
    version: number,
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.changeUuid(
      actor,
      orderUuid,
      version,
      async (db, order) => {
        const existing = await db.purchaseOrderLineItem.findFirst({
          where: { organizationId, uuid: lineUuid, orderId: order.id },
          select: { id: true, received: true },
        });
        if (!existing)
          throw new createError.NotFound("Purchase order line was not found");
        if (existing.received.gt(0))
          throw new createError.UnprocessableEntity(
            "Received lines cannot be deleted",
          );
        // A fully reversed line has zero received quantity but immutable
        // receipt events still reference it; reject before the FK does.
        const receipts = await db.purchaseReceipt.count({
          where: { organizationId, lineId: existing.id },
        });
        if (receipts > 0)
          throw new createError.UnprocessableEntity(
            "Purchase lines with receipt history cannot be deleted",
          );
        await db.purchaseOrderLineItem.delete({
          where: {
            organizationId_id: { organizationId, id: existing.id },
          },
        });
        await PurchaseOrdersService.recalculate(db, actor, order.id);
        return { success: true as const };
      },
    );
  }
}
