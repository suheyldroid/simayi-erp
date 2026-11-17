import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { ItemCategoriesFormatter } from "./formatter";
import { categoryColumns, type ItemCategoriesModel } from "./model";

function categorySelect(organizationId: string) {
  return {
    ...categoryColumns,
    _count: {
      select: {
        children: { where: { organizationId } },
        parts: { where: { organizationId } },
      },
    },
  } satisfies Prisma.PartCategorySelect;
}

function sameOrgCategory(
  organizationId: string,
): Prisma.PartCategoryWhereInput {
  return {
    organizationId,
    AND: [{ OR: [{ parentId: null }, { parent: { organizationId } }] }],
  };
}

/** Resolves an optional public parent UUID to its internal integer relation. */
async function parentIdByUuid(
  db: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  parentUuid: string | null,
): Promise<number | null> {
  if (parentUuid == null) return null;
  const parent = await db.partCategory.findFirst({
    where: { organizationId, uuid: parentUuid },
    select: { id: true },
  });
  if (!parent) throw new createError.NotFound("Parent category was not found");
  return parent.id;
}

export abstract class ItemCategoriesService {
  static async index(actor: TenantActor, query: ItemCategoriesModel["query"]) {
    const organizationId = actor.organizationId;
    if (query.roots && query.parentUuid !== undefined)
      throw new createError.UnprocessableEntity(
        "Choose either roots or a parent category",
      );
    const parentId =
      query.parentUuid === undefined
        ? undefined
        : await CatalogService.categoryIdByUuid(
            prisma,
            organizationId,
            query.parentUuid,
          );
    const structural = CatalogService.flag(query.structural);
    const where: Prisma.PartCategoryWhereInput = {
      ...sameOrgCategory(organizationId),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(query.roots ? { parentId: null } : {}),
      ...(structural !== undefined ? { structural } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { pathstring: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.partCategory.findMany({
        where,
        select: categorySelect(organizationId),
        orderBy: [{ pathstring: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.partCategory.count({ where }),
    ]);
    return {
      items: rows.map((row) => ItemCategoriesFormatter.toCategory(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(actor: TenantActor, uuid: string) {
    const row = await prisma.partCategory.findFirst({
      where: { AND: [sameOrgCategory(actor.organizationId), { uuid }] },
      select: categorySelect(actor.organizationId),
    });
    if (!row) throw new createError.NotFound("Category was not found");
    return ItemCategoriesFormatter.toCategory(row);
  }

  static async parentPath(
    db: Prisma.TransactionClient,
    organizationId: string,
    parentId: number | null,
  ) {
    if (parentId == null) return "";
    const parent = await db.partCategory.findUnique({
      where: { organizationId_id: { organizationId, id: parentId } },
      select: { pathstring: true },
    });
    if (!parent)
      throw new createError.NotFound("Parent category was not found");
    return parent.pathstring;
  }

  static async assertAcyclic(
    db: Prisma.TransactionClient,
    organizationId: string,
    categoryId: number,
    parentId: number | null,
  ) {
    if (parentId == null) return;
    if (parentId === categoryId)
      throw new createError.UnprocessableEntity(
        "A category cannot be its own parent",
      );
    const descendants = await CatalogService.categoryDescendants(
      db,
      organizationId,
      categoryId,
    );
    if (descendants.includes(parentId))
      throw new createError.UnprocessableEntity(
        "A category cannot move under its own child",
      );
  }

  static async refreshPaths(
    db: Prisma.TransactionClient,
    organizationId: string,
    rootId: number,
    rootPath: string,
  ) {
    await db.partCategory.update({
      where: { organizationId_id: { organizationId, id: rootId } },
      data: { pathstring: rootPath },
    });
    const seen = new Set<number>([rootId]);
    let level = [{ id: rootId, path: rootPath }];
    while (level.length) {
      const children = await db.partCategory.findMany({
        where: {
          organizationId,
          parentId: { in: level.map((node) => node.id) },
        },
        select: { id: true, name: true, parentId: true },
      });
      const paths = new Map(level.map((node) => [node.id, node.path]));
      const next: Array<{ id: number; path: string }> = [];
      for (const child of children) {
        if (seen.has(child.id) || child.parentId == null) continue;
        seen.add(child.id);
        const parentPath = paths.get(child.parentId);
        if (parentPath === undefined) continue;
        const path = CatalogService.joinPath(parentPath, child.name);
        await db.partCategory.update({
          where: { organizationId_id: { organizationId, id: child.id } },
          data: { pathstring: path },
        });
        next.push({ id: child.id, path });
      }
      level = next;
    }
  }

  static async store(actor: TenantActor, body: ItemCategoriesModel["body"]) {
    return CatalogService.write("category", async (db) => {
      const name = CatalogService.required(body.name);
      const parentId = await parentIdByUuid(
        db,
        actor.organizationId,
        body.parentUuid ?? null,
      );
      const pathstring = CatalogService.joinPath(
        await ItemCategoriesService.parentPath(
          db,
          actor.organizationId,
          parentId,
        ),
        name,
      );
      const created = await db.partCategory.create({
        data: {
          organizationId: actor.organizationId,
          name,
          description: body.description.trim(),
          parentId,
          pathstring,
          structural: body.structural,
          defaultKeywords: CatalogService.blankToNull(body.defaultKeywords),
          icon: CatalogService.blankToNull(body.icon),
        },
        select: categorySelect(actor.organizationId),
      });
      return ItemCategoriesFormatter.toCategory(created);
    });
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: ItemCategoriesModel["patch"],
  ) {
    return CatalogService.write("category", async (db) => {
      const existing = await db.partCategory.findFirst({
        where: { organizationId: actor.organizationId, uuid },
      });
      if (!existing) throw new createError.NotFound("Category was not found");
      const id = existing.id;
      const name =
        body.name === undefined
          ? existing.name
          : CatalogService.required(body.name);
      const parentId =
        body.parentUuid === undefined
          ? existing.parentId
          : await parentIdByUuid(db, actor.organizationId, body.parentUuid);
      const structural = body.structural ?? existing.structural;
      if (parentId !== existing.parentId)
        await ItemCategoriesService.assertAcyclic(
          db,
          actor.organizationId,
          id,
          parentId,
        );
      if (structural && !existing.structural) {
        const itemCount = await db.part.count({
          where: { organizationId: actor.organizationId, categoryId: id },
        });
        if (itemCount > 0)
          throw new createError.UnprocessableEntity(
            "Move items out before marking the category structural",
          );
      }
      const parentPath =
        parentId == null
          ? ""
          : await ItemCategoriesService.parentPath(
              db,
              actor.organizationId,
              parentId,
            );
      const pathstring = CatalogService.joinPath(parentPath, name);
      await db.partCategory.update({
        where: {
          organizationId_id: { organizationId: actor.organizationId, id },
        },
        data: {
          name,
          description:
            body.description === undefined
              ? existing.description
              : body.description.trim(),
          parentId,
          pathstring,
          structural,
          defaultKeywords:
            body.defaultKeywords === undefined
              ? existing.defaultKeywords
              : CatalogService.blankToNull(body.defaultKeywords),
          icon:
            body.icon === undefined
              ? existing.icon
              : CatalogService.blankToNull(body.icon),
        },
      });
      if (name !== existing.name || parentId !== existing.parentId)
        await ItemCategoriesService.refreshPaths(
          db,
          actor.organizationId,
          id,
          pathstring,
        );
      const row = await db.partCategory.findFirst({
        where: { AND: [sameOrgCategory(actor.organizationId), { id }] },
        select: categorySelect(actor.organizationId),
      });
      if (!row) throw new createError.NotFound("Category was not found");
      return ItemCategoriesFormatter.toCategory(row);
    });
  }

  static async destroy(actor: TenantActor, uuid: string) {
    return CatalogService.write("category", async (db) => {
      const existing = await db.partCategory.findFirst({
        where: { organizationId: actor.organizationId, uuid },
        include: {
          _count: {
            select: {
              children: { where: { organizationId: actor.organizationId } },
              parts: { where: { organizationId: actor.organizationId } },
            },
          },
        },
      });
      if (!existing) throw new createError.NotFound("Category was not found");
      if (existing._count.children > 0)
        throw new createError.Conflict("Move or delete child categories first");
      if (existing._count.parts > 0)
        throw new createError.Conflict(
          "Move or delete items in this category first",
        );
      await db.partCategory.delete({
        where: {
          organizationId_id: {
            organizationId: actor.organizationId,
            id: existing.id,
          },
        },
      });
      return { success: true as const };
    });
  }
}
