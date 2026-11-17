import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { mediaPurpose } from "@/modules/media/model";
import { MediaFilesService } from "@/modules/media/service";
import { UnitsService } from "../units/service";
import { ItemsFormatter } from "./formatter";
import { itemColumns, type ItemsModel } from "./model";
import { ItemStockService } from "./stock/service";

function sameOrgItem(organizationId: string): Prisma.PartWhereInput {
  return {
    organizationId,
    AND: [{ OR: [{ categoryId: null }, { category: { organizationId } }] }],
  };
}

const staleVersion =
  "The item was updated by someone else. Reload and try again.";

export abstract class ItemsService {
  static async index(actor: TenantActor, query: ItemsModel["query"]) {
    const organizationId = actor.organizationId;
    const where: Prisma.PartWhereInput = sameOrgItem(organizationId);
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { ipn: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.categoryUuid !== undefined) {
      const categoryId = await CatalogService.categoryIdByUuid(
        prisma,
        organizationId,
        query.categoryUuid,
      );
      if (CatalogService.flag(query.subcategories)) {
        const descendants = await CatalogService.categoryDescendants(
          prisma,
          organizationId,
          categoryId,
        );
        where.categoryId = { in: [categoryId, ...descendants] };
      } else where.categoryId = categoryId;
    }
    const active = CatalogService.flag(query.active);
    if (active !== undefined) where.active = active;
    const [rows, total] = await prisma.$transaction([
      prisma.part.findMany({
        where,
        select: itemColumns,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.part.count({ where }),
    ]);
    return {
      items: rows.map((row) => ItemsFormatter.toItem(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(actor: TenantActor, uuid: string) {
    return ItemsFormatter.toItem(
      await ItemsService.loadByUuid(prisma, actor.organizationId, uuid),
    );
  }

  /** Internal integer lookup for callers that already resolved the item. */
  static async load(
    db: Prisma.TransactionClient,
    organizationId: string,
    id: number,
  ) {
    const row = await db.part.findFirst({
      where: { AND: [sameOrgItem(organizationId), { id }] },
      select: itemColumns,
    });
    if (!row) throw new createError.NotFound("Item was not found");
    return row;
  }

  /** Public UUID boundary; cross-organization UUIDs stay invisible. */
  static async loadByUuid(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    uuid: string,
  ) {
    const row = await db.part.findFirst({
      where: { AND: [sameOrgItem(organizationId), { uuid }] },
      select: itemColumns,
    });
    if (!row) throw new createError.NotFound("Item was not found");
    return row;
  }

  static async store(actor: TenantActor, body: ItemsModel["body"]) {
    return CatalogService.write("item", async (db) => {
      const name = CatalogService.required(body.name);
      const categoryId =
        body.categoryUuid == null
          ? null
          : await CatalogService.categoryIdByUuid(
              db,
              actor.organizationId,
              body.categoryUuid,
            );
      await CatalogService.usableCategory(db, actor.organizationId, categoryId);
      const unit = await UnitsService.usable(db, body.unitUuid);
      const image = CatalogService.blankToNull(body.image);
      const created = await db.part.create({
        data: {
          organizationId: actor.organizationId,
          name,
          description: body.description?.trim() ?? "",
          categoryId,
          unitId: unit.id,
          image,
          ipn: CatalogService.blankToNull(body.ipn),
          defaultExpiry: body.defaultExpiry ?? 0,
          active: body.active ?? true,
          creationDate: new Date(),
          creationUserId: actor.userId,
          version: 0,
        },
      });
      if (image !== null)
        await MediaFilesService.claimImage(
          db,
          actor,
          mediaPurpose.itemImage,
          image,
          created.uuid,
        );
      return ItemsFormatter.toItem(
        await ItemsService.load(db, actor.organizationId, created.id),
      );
    });
  }

  /**
   * Reassigning an already assigned unit is only safe while nothing depends on
   * the old one in any branch: no balance, recipe/order/sale link, or recorded
   * tracking event. Items without a unit are not checked at all: an unresolved
   * legacy item is being explicitly assigned, not rewriting history, so callers
   * skip this guard when `unitId` is null.
   */
  static async assertUnitChangeable(
    db: Prisma.TransactionClient,
    organizationId: string,
    item: { id: number },
  ): Promise<void> {
    const blocked = () =>
      new createError.Conflict(
        "The item unit cannot change while stock or recorded history depends on it",
      );
    const balances = await db.branchStock.count({
      where: {
        organizationId,
        itemId: item.id,
        stock: { not: new Prisma.Decimal(0) },
      },
    });
    if (balances > 0) throw blocked();
    const recipeLines = await db.recipeLine.count({
      where: { organizationId, itemId: item.id },
    });
    const orderLines = await db.purchaseOrderLineItem.count({
      where: { organizationId, itemId: item.id },
    });
    const saleLinks = await db.buildComponent.count({
      where: { organizationId, componentId: item.id },
    });
    const saleConsumptions = await db.buildConsumption.count({
      where: { organizationId, itemId: item.id },
    });
    const tracking = await db.itemTracking.count({
      where: { organizationId, itemId: item.id },
    });
    if (
      recipeLines > 0 ||
      orderLines > 0 ||
      saleLinks > 0 ||
      saleConsumptions > 0 ||
      tracking > 0
    )
      throw blocked();
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: ItemsModel["patch"],
  ) {
    return CatalogService.write("item", async (db) => {
      await ItemStockService.lock(db);
      const existing = await db.part.findFirst({
        where: { organizationId: actor.organizationId, uuid },
        select: {
          id: true,
          version: true,
          name: true,
          description: true,
          categoryId: true,
          unitId: true,
          image: true,
          ipn: true,
          defaultExpiry: true,
          active: true,
        },
      });
      if (!existing) throw new createError.NotFound("Item was not found");
      const id = existing.id;
      if (body.version !== existing.version)
        throw new createError.Conflict(staleVersion);
      const categoryId =
        body.categoryUuid === undefined
          ? existing.categoryId
          : body.categoryUuid === null
            ? null
            : await CatalogService.categoryIdByUuid(
                db,
                actor.organizationId,
                body.categoryUuid,
              );
      await CatalogService.usableCategory(db, actor.organizationId, categoryId);
      let unitId = existing.unitId;
      if (body.unitUuid !== undefined) {
        const next = await UnitsService.resolve(db, body.unitUuid);
        if (next.id !== existing.unitId) {
          if (!next.active)
            throw new createError.UnprocessableEntity(
              "An inactive unit cannot be selected",
            );
          // Only a reassignment of an assigned unit rewrites history; a NULL
          // unit is a legacy unresolved item being explicitly assigned.
          if (existing.unitId !== null)
            await ItemsService.assertUnitChangeable(
              db,
              actor.organizationId,
              existing,
            );
          unitId = next.id;
        }
      }
      const image =
        body.image === undefined
          ? existing.image
          : CatalogService.blankToNull(body.image);
      // A changed image must be this tenant's uploaded temporary image; an
      // unchanged historical external value is preserved without rewriting.
      // The old binding is released first so the same target reference can be
      // claimed again under the unique index; the transaction rolls both back.
      if (body.image !== undefined && image !== existing.image) {
        if (existing.image !== null)
          await MediaFilesService.releaseImage(
            db,
            actor.organizationId,
            mediaPurpose.itemImage,
            uuid,
          );
        if (image !== null)
          await MediaFilesService.claimImage(
            db,
            actor,
            mediaPurpose.itemImage,
            image,
            uuid,
          );
      }
      const saved = await db.part.updateMany({
        where: {
          organizationId: actor.organizationId,
          id,
          version: existing.version,
        },
        data: {
          name:
            body.name === undefined
              ? existing.name
              : CatalogService.required(body.name),
          description:
            body.description === undefined
              ? existing.description
              : body.description.trim(),
          categoryId,
          unitId,
          image,
          ipn:
            body.ipn === undefined
              ? existing.ipn
              : CatalogService.blankToNull(body.ipn),
          defaultExpiry: body.defaultExpiry ?? existing.defaultExpiry,
          active: body.active ?? existing.active,
          version: { increment: 1 },
        },
      });
      if (saved.count !== 1) throw new createError.Conflict(staleVersion);
      return ItemsFormatter.toItem(
        await ItemsService.load(db, actor.organizationId, id),
      );
    });
  }

  static async destroy(actor: TenantActor, uuid: string) {
    return CatalogService.write("item", async (db) => {
      await ItemStockService.lock(db);
      const existing = await db.part.findFirst({
        where: { organizationId: actor.organizationId, uuid },
        select: { id: true, image: true },
      });
      if (!existing) throw new createError.NotFound("Item was not found");
      // Purchase receipt events are immutable history; deleting the catalog
      // item would only null their live link, so reject intentionally while
      // any event (including a reversed one) still references it.
      const receipts = await db.purchaseReceipt.count({
        where: { organizationId: actor.organizationId, itemId: existing.id },
      });
      if (receipts > 0)
        throw new createError.Conflict(
          "An item with purchase receipt history cannot be deleted",
        );
      const balances = await db.branchStock.count({
        where: {
          organizationId: actor.organizationId,
          itemId: existing.id,
          stock: { not: new Prisma.Decimal(0) },
        },
      });
      if (balances > 0)
        throw new createError.Conflict(
          "An item with stock cannot be deleted. Remove its branch stock first.",
        );
      // Zero balances are configuration, not history; they die with the item.
      await db.branchStock.deleteMany({
        where: { organizationId: actor.organizationId, itemId: existing.id },
      });
      await db.part.delete({
        where: {
          organizationId_id: {
            organizationId: actor.organizationId,
            id: existing.id,
          },
        },
      });
      if (existing.image !== null)
        await MediaFilesService.releaseImage(
          db,
          actor.organizationId,
          mediaPurpose.itemImage,
          uuid,
        );
      return { success: true as const };
    });
  }
}
