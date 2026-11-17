import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import { CatalogService } from "@/lib/catalog";
import { unitColumns, type UnitsModel } from "./model";

type Database = Prisma.TransactionClient | typeof prisma;

export abstract class UnitsService {
  /**
   * Internal lookup by public UUID. The catalog is global, so no organization
   * participates: every tenant resolves the same unit row.
   */
  static async resolve(
    db: Database,
    uuid: string,
  ): Promise<{ id: number; code: string; active: boolean }> {
    const row = await db.unit.findUnique({
      where: { uuid },
      select: { id: true, code: true, active: true },
    });
    if (!row) throw new createError.NotFound("Unit was not found");
    return row;
  }

  /** A unit may only be newly assigned to an item while it is active. */
  static async usable(
    db: Database,
    uuid: string,
  ): Promise<{ id: number; code: string; active: boolean }> {
    const unit = await UnitsService.resolve(db, uuid);
    if (!unit.active)
      throw new createError.UnprocessableEntity(
        "An inactive unit cannot be selected",
      );
    return unit;
  }

  static async index(query: UnitsModel["query"]): Promise<UnitsModel["list"]> {
    const where: Prisma.UnitWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { code: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const active = CatalogService.flag(query.active);
    if (active !== undefined) where.active = active;
    const [items, total] = await prisma.$transaction([
      prisma.unit.findMany({
        where,
        select: unitColumns,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.unit.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  static async show(uuid: string): Promise<UnitsModel["unit"]> {
    const row = await prisma.unit.findUnique({
      where: { uuid },
      select: unitColumns,
    });
    if (!row) throw new createError.NotFound("Unit was not found");
    return row;
  }

  static async store(body: UnitsModel["body"]): Promise<UnitsModel["unit"]> {
    return CatalogService.write("item", async (db) => {
      const name = CatalogService.required(body.name);
      const code = CatalogService.required(body.code);
      const duplicate = await db.unit.findUnique({
        where: { code },
        select: { id: true },
      });
      if (duplicate)
        throw new createError.Conflict("A unit with this code already exists");
      return db.unit.create({
        data: {
          name,
          code,
          active: body.active ?? true,
          divisible: body.divisible ?? true,
        },
        select: unitColumns,
      });
    });
  }

  static async update(
    uuid: string,
    body: UnitsModel["patch"],
  ): Promise<UnitsModel["unit"]> {
    return CatalogService.write("item", async (db) => {
      const existing = await db.unit.findUnique({
        where: { uuid },
        select: { id: true, code: true, version: true },
      });
      if (!existing) throw new createError.NotFound("Unit was not found");
      if (body.version !== existing.version)
        throw new createError.Conflict(
          "The unit was updated by someone else. Reload and try again.",
        );
      const name =
        body.name === undefined
          ? undefined
          : CatalogService.required(body.name);
      const code =
        body.code === undefined
          ? undefined
          : CatalogService.required(body.code);
      if (code !== undefined && code !== existing.code) {
        // Codes are frozen once items point at them; historical snapshots keep
        // their own copy and are never rewritten. The usage check spans every
        // organization because the catalog is global.
        const used = await db.part.count({ where: { unitId: existing.id } });
        if (used > 0)
          throw new createError.Conflict(
            "The code of a unit that items already use cannot change",
          );
        const duplicate = await db.unit.findUnique({
          where: { code },
          select: { id: true },
        });
        if (duplicate)
          throw new createError.Conflict(
            "A unit with this code already exists",
          );
      }
      const saved = await db.unit.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          ...(name === undefined ? {} : { name }),
          ...(code === undefined ? {} : { code }),
          ...(body.active === undefined ? {} : { active: body.active }),
          ...(body.divisible === undefined
            ? {}
            : { divisible: body.divisible }),
          version: { increment: 1 },
        },
      });
      if (saved.count !== 1)
        throw new createError.Conflict(
          "The unit was updated by someone else. Reload and try again.",
        );
      const row = await db.unit.findUnique({
        where: { id: existing.id },
        select: unitColumns,
      });
      if (!row) throw new createError.NotFound("Unit was not found");
      return row;
    });
  }

  static async destroy(uuid: string): Promise<UnitsModel["success"]> {
    return CatalogService.write("item", async (db) => {
      const existing = await db.unit.findUnique({
        where: { uuid },
        select: { id: true },
      });
      if (!existing) throw new createError.NotFound("Unit was not found");
      const used = await db.part.count({ where: { unitId: existing.id } });
      if (used > 0)
        throw new createError.Conflict(
          "This unit is used by items and cannot be deleted",
        );
      await db.unit.delete({ where: { id: existing.id } });
      return { success: true as const };
    });
  }
}
