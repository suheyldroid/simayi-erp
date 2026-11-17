import type { Prisma } from "../../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { SystemPreferencesService } from "../../../system-preferences/service";
import { OrderService } from "../../service";
import { PurchaseOrdersService } from "../service";
import { ExtraLinesFormatter } from "./formatter";
import { extraLineSelect, type ExtraLinesModel } from "./model";

export abstract class ExtraLinesService {
  static amount(price: string | null | undefined): Prisma.Decimal | null {
    if (price == null) return null;
    return OrderService.money(price);
  }

  static async index(
    actor: TenantActor,
    orderUuid: string,
    query: ExtraLinesModel["query"],
  ): Promise<ExtraLinesModel["list"]> {
    const organizationId = actor.organizationId;
    const order = await PurchaseOrdersService.resolve(
      prisma,
      organizationId,
      orderUuid,
    );
    const where = { organizationId, orderId: order.id };
    const [rows, total] = await prisma.$transaction([
      prisma.purchaseOrderExtraLine.findMany({
        where,
        select: extraLineSelect,
        orderBy: [{ lineInt: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.purchaseOrderExtraLine.count({ where }),
    ]);
    return {
      items: rows.map((row) => ExtraLinesFormatter.toLine(row, order.uuid)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async store(
    actor: TenantActor,
    orderUuid: string,
    body: ExtraLinesModel["body"],
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.changeUuid(
      actor,
      orderUuid,
      body.version,
      async (db, order) => {
        const price = ExtraLinesService.amount(body.price);
        const numbered = OrderService.lineNumber(body.line);
        const currencyCode = await SystemPreferencesService.requireCurrency(db);
        const created = await db.purchaseOrderExtraLine.create({
          data: {
            organizationId,
            orderId: order.id,
            description: body.description?.trim() ?? "",
            quantity: OrderService.quantity(body.quantity),
            discount: OrderService.discount(body.discount),
            price,
            currencyCode,
            line: numbered.line,
            lineInt: numbered.lineInt,
            reference: body.reference?.trim() ?? "",
            notes: body.notes?.trim() ?? "",
            link: body.link?.trim() ?? "",
            targetDate: OrderService.optionalDay(body.targetDate) ?? null,
            context: CatalogService.json(body.context, true),
          },
          select: extraLineSelect,
        });
        await PurchaseOrdersService.recalculate(db, actor, order.id);
        return ExtraLinesFormatter.toLine(created, order.uuid);
      },
    );
  }

  static async update(
    actor: TenantActor,
    orderUuid: string,
    lineUuid: string,
    body: ExtraLinesModel["patch"],
  ) {
    const organizationId = actor.organizationId;
    return PurchaseOrdersService.changeUuid(
      actor,
      orderUuid,
      body.version,
      async (db, order) => {
        const existing = await db.purchaseOrderExtraLine.findFirst({
          where: { organizationId, uuid: lineUuid, orderId: order.id },
          select: extraLineSelect,
        });
        if (!existing)
          throw new createError.NotFound("Extra line was not found");
        const price =
          body.price === undefined
            ? existing.price
            : ExtraLinesService.amount(body.price);
        // A newly written price is denominated in the fixed system currency.
        // Other edits keep the stored snapshot untouched, and an echoed equal
        // amount is not a new price.
        const currencyCode =
          body.price === undefined ||
          body.price === null ||
          (existing.price !== null &&
            price !== null &&
            price.equals(existing.price))
            ? null
            : await SystemPreferencesService.requireCurrency(db);
        const numbered =
          body.line === undefined ? null : OrderService.lineNumber(body.line);
        const saved = await db.purchaseOrderExtraLine.update({
          where: {
            organizationId_id: { organizationId, id: existing.id },
          },
          data: {
            organizationId,
            price,
            ...(currencyCode === null ? {} : { currencyCode }),
            ...(body.description === undefined
              ? {}
              : { description: body.description.trim() }),
            ...(body.quantity === undefined
              ? {}
              : { quantity: OrderService.quantity(body.quantity) }),
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
            ...(body.context === undefined
              ? {}
              : { context: CatalogService.json(body.context, false) }),
          },
          select: extraLineSelect,
        });
        await PurchaseOrdersService.recalculate(db, actor, order.id);
        return ExtraLinesFormatter.toLine(saved, order.uuid);
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
        const existing = await db.purchaseOrderExtraLine.findFirst({
          where: { organizationId, uuid: lineUuid, orderId: order.id },
          select: { id: true },
        });
        if (!existing)
          throw new createError.NotFound("Extra line was not found");
        await db.purchaseOrderExtraLine.delete({
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
