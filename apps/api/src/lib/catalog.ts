import { createHash } from "node:crypto";
import { Prisma } from "../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";

type Database = Prisma.TransactionClient | typeof prisma;

/**
 * Shared item catalog helpers. Item CRUD lives in modules/items, category CRUD
 * in modules/item-categories, and recipe editing in modules/recipes.
 */
export abstract class CatalogService {
  static flag(
    value: boolean | "true" | "false" | undefined,
  ): boolean | undefined {
    if (value === undefined) return undefined;
    return value === true || value === "true";
  }

  static required(value: string): string {
    const trimmed = value.trim();
    if (!trimmed)
      throw new createError.UnprocessableEntity("Value is required");
    return trimmed;
  }

  static blankToNull(value: string | null | undefined): string | null {
    if (value == null || value.trim() === "") return null;
    return value.trim();
  }

  static json(
    value: Record<string, unknown> | null | undefined,
    creating: boolean,
  ): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
    if (value === undefined) return creating ? Prisma.DbNull : undefined;
    if (value === null) return Prisma.DbNull;
    return value as Prisma.InputJsonObject;
  }

  static jsonObject(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (value === null) return null;
    if (typeof value !== "object" || Array.isArray(value))
      throw new createError.InternalServerError("Invalid JSON object");
    return value;
  }

  static barcode(data: string): { barcodeData: string; barcodeHash: string } {
    const barcodeData = data.trim();
    const barcodeHash = barcodeData
      ? createHash("sha256").update(barcodeData).digest("hex")
      : "";
    return { barcodeData, barcodeHash };
  }

  static joinPath(parentPath: string, name: string): string {
    const path = parentPath ? `${parentPath}/${name}` : name;
    if (path.length > 250)
      throw new createError.UnprocessableEntity("Path exceeds 250 characters");
    return path;
  }

  static day(value: Date | null): string | null {
    if (value == null) return null;
    return value.toISOString().slice(0, 10);
  }

  static async lockItem(db: Prisma.TransactionClient): Promise<void> {
    // Advisory locks take no result row: pg_advisory_xact_lock returns void,
    // and the Prisma PostgreSQL adapter cannot deserialize a void column.
    await db.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(814203::bigint)`,
    );
  }

  static async write<T>(
    lock: "category" | "item",
    run: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(
      async (db) => {
        if (lock === "category") {
          await db.$executeRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(814202::bigint)`,
          );
        } else {
          await CatalogService.lockItem(db);
        }
        return run(db);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  static async categoryDescendants(
    db: Database,
    organizationId: string,
    rootId: number,
  ): Promise<number[]> {
    const seen = new Set<number>([rootId]);
    const ids: number[] = [];
    let level = [rootId];
    while (level.length) {
      const children = await db.partCategory.findMany({
        where: { organizationId, parentId: { in: level } },
        select: { id: true },
      });
      level = [];
      for (const child of children) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        ids.push(child.id);
        level.push(child.id);
      }
    }
    return ids;
  }

  /** Public UUID boundary for the integer-only category helpers below. */
  static async categoryIdByUuid(
    db: Database,
    organizationId: string,
    uuid: string,
  ): Promise<number> {
    const row = await db.partCategory.findFirst({
      where: { organizationId, uuid },
      select: { id: true },
    });
    if (!row) throw new createError.NotFound("Category was not found");
    return row.id;
  }

  static async usableCategory(
    db: Database,
    organizationId: string,
    categoryId: number | null,
  ) {
    if (categoryId == null) return null;
    const row = await db.partCategory.findUnique({
      where: { organizationId_id: { organizationId, id: categoryId } },
      select: {
        id: true,
        structural: true,
        defaultKeywords: true,
      },
    });
    if (!row) throw new createError.NotFound("Category was not found");
    if (row.structural)
      throw new createError.UnprocessableEntity(
        "Structural categories cannot contain items",
      );
    return row;
  }
}
