import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { Decimal, decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { BranchesService } from "@/modules/branches/service";
import { itemColumns, type ItemRecord } from "../model";
import type { StockModel, StockOperation } from "./model";

const staleVersion =
  "The branch stock was updated by someone else. Reload and try again.";
/** A DECIMAL(20,5) balance holds at most 15 integer digits. */
const maximumBalance = new Decimal(10).pow(15);

/**
 * Explicit branch balance target. `BranchActor` from the tenant layer is
 * structurally assignable; sales callers may target the persisted branch of
 * their batch instead of the request header branch, having verified it first.
 */
export type StockScope = {
  organizationId: string;
  branchId: number;
  userId: string | null;
  /** Public branch identity when the caller already resolved it. */
  branchUuid?: string;
};

/** Public branch provenance of one position row. */
type StockBranch = { uuid: string; name: string; active: boolean };

/** One item x branch position; a missing balance row is exact zero. */
type StockPosition = {
  itemId: number;
  branchUuid: string;
  branchName: string;
  branchActive: boolean;
  stock: Prisma.Decimal | null;
  minimumStock: Prisma.Decimal | null;
  version: number | null;
};

export abstract class ItemStockService {
  /**
   * Serializes every branch balance write. Acquired through
   * pg_advisory_xact_lock so an existing transaction can call it again.
   */
  static async lock(db: Prisma.TransactionClient): Promise<void> {
    await db.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(814205::bigint)`,
    );
  }

  /** Parses an exact stock amount accepting at most 5 fraction digits. */
  static quantity(value: string, allowZero = false): Prisma.Decimal {
    const result = decimal(value.trim(), 5, 15);
    if (result.isNegative() || (!allowZero && !result.gt(0)))
      throw new createError.UnprocessableEntity(
        allowZero
          ? "Quantity cannot be negative"
          : "Quantity must be greater than 0",
      );
    return result;
  }

  static notes(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  }

  /**
   * Exact branch balance. A missing row is an exact zero and is never created
   * by a read; the item is not validated so sales planning can treat unstored
   * catalog items as empty.
   */
  static async balance(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    branchId: number,
    itemId: number,
  ): Promise<Prisma.Decimal> {
    const row = await db.branchStock.findUnique({
      where: { branchId_itemId: { branchId, itemId } },
      select: { organizationId: true, stock: true },
    });
    if (!row || row.organizationId !== organizationId) return new Decimal(0);
    return row.stock;
  }

  /** Batch balance read; absent entries mean an exact zero balance. */
  static async balances(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    branchId: number,
    itemIds: number[],
  ): Promise<Map<number, Prisma.Decimal>> {
    const balances = new Map<number, Prisma.Decimal>();
    if (itemIds.length === 0) return balances;
    const rows = await db.branchStock.findMany({
      where: { organizationId, branchId, itemId: { in: itemIds } },
      select: { itemId: true, stock: true },
    });
    for (const row of rows) balances.set(row.itemId, row.stock);
    return balances;
  }

  /**
   * Applies one balance change and records the matching item tracking entry.
   * The caller owns the database transaction and any response formatting.
   */
  static async change(
    db: Prisma.TransactionClient,
    scope: StockScope,
    itemId: number,
    operation: StockOperation,
    quantity: Prisma.Decimal | string,
    options: {
      version?: number;
      trackingType?: number;
      notes?: string | null;
      deltas?: Prisma.InputJsonObject;
    } = {},
  ): Promise<{
    item: ItemRecord;
    before: Prisma.Decimal;
    after: Prisma.Decimal;
    version: number;
    branchId: number;
    branchUuid: string;
  }> {
    await ItemStockService.lock(db);
    const item = await db.part.findUnique({
      where: {
        organizationId_id: {
          organizationId: scope.organizationId,
          id: itemId,
        },
      },
      select: {
        id: true,
        version: true,
        unit: { select: { code: true } },
      },
    });
    if (!item) throw new createError.NotFound("Item was not found");
    if (!item.unit)
      throw new createError.UnprocessableEntity(
        "Assign a unit to this item before changing its stock",
      );
    const branchUuid =
      scope.branchUuid ??
      (
        await db.branch.findUnique({
          where: {
            organizationId_id: {
              organizationId: scope.organizationId,
              id: scope.branchId,
            },
          },
          select: { uuid: true },
        })
      )?.uuid;
    if (branchUuid === undefined)
      throw new createError.NotFound("Branch was not found");

    const amount =
      typeof quantity === "string"
        ? ItemStockService.quantity(quantity, operation === "count")
        : quantity;
    if (!amount.isFinite() || amount.decimalPlaces() > 5)
      throw new createError.UnprocessableEntity(
        "Decimal exceeds the supported precision or scale",
      );
    if (operation === "count") {
      if (amount.isNegative())
        throw new createError.UnprocessableEntity(
          "Quantity cannot be negative",
        );
    } else if (!amount.gt(0)) {
      throw new createError.UnprocessableEntity(
        "Quantity must be greater than 0",
      );
    }

    const balance = await db.branchStock.findUnique({
      where: { branchId_itemId: { branchId: scope.branchId, itemId } },
      select: { id: true, organizationId: true, stock: true, version: true },
    });
    if (balance !== null && balance.organizationId !== scope.organizationId)
      throw new createError.InternalServerError(
        "Branch balance scope does not match the organization",
      );
    const before = balance?.stock ?? new Decimal(0);
    const currentVersion = balance?.version ?? 0;
    if (options.version !== undefined && options.version !== currentVersion)
      throw new createError.Conflict(staleVersion);

    const after =
      operation === "add"
        ? before.add(amount)
        : operation === "remove"
          ? before.sub(amount)
          : amount;
    if (!after.isFinite())
      throw new createError.UnprocessableEntity(
        "Stock exceeds the supported balance",
      );
    if (after.isNegative())
      throw new createError.UnprocessableEntity("Stock cannot go below zero");
    if (after.gte(maximumBalance))
      throw new createError.UnprocessableEntity(
        "Stock exceeds the supported balance",
      );

    let version: number;
    if (balance === null) {
      const created = await db.branchStock.create({
        data: {
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          itemId,
          stock: after,
          version: 1,
        },
        select: { version: true },
      });
      version = created.version;
    } else {
      const saved = await db.branchStock.updateMany({
        where: { id: balance.id, version: currentVersion },
        data: { stock: after, version: { increment: 1 } },
      });
      if (saved.count !== 1) throw new createError.Conflict(staleVersion);
      version = currentVersion + 1;
    }

    const trackingType =
      options.trackingType ??
      (operation === "add" ? 11 : operation === "remove" ? 12 : 10);
    await db.itemTracking.create({
      data: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        itemId,
        trackingType,
        userId: scope.userId,
        notes: ItemStockService.notes(options.notes),
        deltas: options.deltas,
        quantityBefore: before,
        quantityAfter: after,
        unitCode: item.unit.code,
      },
    });

    const row = await db.part.findUnique({
      where: {
        organizationId_id: {
          organizationId: scope.organizationId,
          id: itemId,
        },
      },
      select: itemColumns,
    });
    if (!row) throw new createError.NotFound("Item was not found");
    return {
      item: row,
      before,
      after,
      version,
      branchId: scope.branchId,
      branchUuid,
    };
  }
}

/** HTTP-facing branch stock operations. */
export abstract class StockService {
  static async index(
    actor: TenantActor,
    query: StockModel["query"],
  ): Promise<StockModel["list"]> {
    const organizationId = actor.organizationId;
    // Company context lists one position per item and same-company branch,
    // including branches that were closed later so history stays visible. A
    // verified branch header narrows the list to exactly that branch. Reads
    // never create a missing balance row: it projects as stock 0/version 0.
    const branchScope =
      actor.branchId === null
        ? Prisma.empty
        : Prisma.sql`AND b.id = ${actor.branchId}`;
    const filters = Prisma.sql`
      p.organization_id = ${organizationId}
      AND (p.category_id IS NULL OR EXISTS (
        SELECT 1 FROM "part_category" c
        WHERE c.id = p.category_id AND c.organization_id = p.organization_id
      ))
    `;
    const search =
      query.search === undefined
        ? Prisma.empty
        : Prisma.sql`AND (
            p.name ILIKE ${`%${query.search}%`}
            OR p.description ILIKE ${`%${query.search}%`}
            OR COALESCE(p.ipn, '') ILIKE ${`%${query.search}%`}
          )`;
    const category = await StockService.categoryFilter(organizationId, query);
    const active =
      query.active === undefined
        ? Prisma.empty
        : Prisma.sql`AND p.active = ${query.active === true || query.active === "true"}`;
    const low =
      query.low === true || query.low === "true"
        ? Prisma.sql`AND COALESCE(bs.stock, 0) <= COALESCE(bs.minimum_stock, 0)`
        : Prisma.empty;
    const joined = Prisma.sql`
      FROM "part" p
      CROSS JOIN "branch" b
      LEFT JOIN "branch_stock" bs
        ON bs.organization_id = p.organization_id
        AND bs.branch_id = b.id
        AND bs.item_id = p.id
      WHERE ${filters}
        AND b.organization_id = ${organizationId}
        ${branchScope} ${search} ${category} ${active} ${low}
    `;
    const [rows, totals] = await prisma.$transaction([
      prisma.$queryRaw<StockPosition[]>(Prisma.sql`
        SELECT
          p.id AS "itemId",
          b.uuid AS "branchUuid",
          b.name AS "branchName",
          b.active AS "branchActive",
          bs.stock,
          bs.minimum_stock AS "minimumStock",
          bs.version
        ${joined}
        ORDER BY p.name ASC, p.id ASC, b.name ASC, b.id ASC
        LIMIT ${query.limit} OFFSET ${query.offset}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total ${joined}
      `),
    ]);
    const total = totals.at(0)?.total ?? 0;
    const items = await StockService.present(organizationId, rows);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<StockModel["balance"]> {
    const scope = await BranchesService.requireActor(prisma, actor);
    const item = await prisma.part.findFirst({
      where: {
        organizationId: actor.organizationId,
        uuid,
      },
      select: { id: true },
    });
    if (!item) throw new createError.NotFound("Item was not found");
    const balance = await prisma.branchStock.findUnique({
      where: { branchId_itemId: { branchId: scope.branchId, itemId: item.id } },
      select: { stock: true, minimumStock: true, version: true },
    });
    return StockService.presentOne(
      prisma,
      actor.organizationId,
      scope.branch,
      item.id,
      balance,
    );
  }

  static async minimum(
    actor: TenantActor,
    uuid: string,
    body: StockModel["minimum"],
  ): Promise<StockModel["balance"]> {
    const minimumStock = decimal(body.minimumStock.trim(), 6, 13);
    if (minimumStock.isNegative())
      throw new createError.UnprocessableEntity(
        "Minimum stock cannot be negative",
      );
    return prisma.$transaction(
      async (db) => {
        const scope = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        await ItemStockService.lock(db);
        const item = await db.part.findFirst({
          where: { organizationId: actor.organizationId, uuid },
          select: { id: true },
        });
        if (!item) throw new createError.NotFound("Item was not found");
        const balance = await db.branchStock.findUnique({
          where: {
            branchId_itemId: { branchId: scope.branchId, itemId: item.id },
          },
          select: { id: true, version: true },
        });
        if (balance === null) {
          if (body.version !== 0) throw new createError.Conflict(staleVersion);
          await db.branchStock.create({
            data: {
              organizationId: actor.organizationId,
              branchId: scope.branchId,
              itemId: item.id,
              minimumStock,
              version: 1,
            },
          });
        } else {
          if (body.version !== balance.version)
            throw new createError.Conflict(staleVersion);
          const saved = await db.branchStock.updateMany({
            where: { id: balance.id, version: balance.version },
            data: { minimumStock, version: { increment: 1 } },
          });
          if (saved.count !== 1) throw new createError.Conflict(staleVersion);
        }
        const row = await db.branchStock.findUnique({
          where: {
            branchId_itemId: { branchId: scope.branchId, itemId: item.id },
          },
          select: { stock: true, minimumStock: true, version: true },
        });
        return StockService.presentOne(
          db,
          actor.organizationId,
          scope.branch,
          item.id,
          row,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** HTTP adapter for the manual add, remove, and count actions. */
  static async adjust(
    actor: TenantActor,
    uuid: string,
    operation: StockOperation,
    body: StockModel["body"],
  ): Promise<StockModel["balance"]> {
    return prisma.$transaction(
      async (db) => {
        const scope = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        const item = await db.part.findFirst({
          where: { organizationId: actor.organizationId, uuid },
          select: { id: true },
        });
        if (!item) throw new createError.NotFound("Item was not found");
        await ItemStockService.change(
          db,
          {
            organizationId: actor.organizationId,
            branchId: scope.branchId,
            branchUuid: scope.branchUuid,
            userId: actor.userId,
          },
          item.id,
          operation,
          body.quantity,
          { version: body.version, notes: body.notes },
        );
        const row = await db.branchStock.findUnique({
          where: {
            branchId_itemId: { branchId: scope.branchId, itemId: item.id },
          },
          select: { stock: true, minimumStock: true, version: true },
        });
        return StockService.presentOne(
          db,
          actor.organizationId,
          scope.branch,
          item.id,
          row,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private static async categoryFilter(
    organizationId: string,
    query: StockModel["query"],
  ): Promise<Prisma.Sql> {
    if (query.categoryUuid === undefined) return Prisma.empty;
    const category = await prisma.partCategory.findFirst({
      where: { organizationId, uuid: query.categoryUuid },
      select: { id: true },
    });
    if (!category) throw new createError.NotFound("Category was not found");
    if (!(query.subcategories === true || query.subcategories === "true"))
      return Prisma.sql`AND p.category_id = ${category.id}`;
    return Prisma.sql`AND p.category_id IN (
      WITH RECURSIVE tree AS (
        SELECT id FROM "part_category"
        WHERE organization_id = ${organizationId} AND id = ${category.id}
        UNION ALL
        SELECT child.id
        FROM "part_category" child
        JOIN tree ON child.parent_id = tree.id
        WHERE child.organization_id = ${organizationId}
      )
      SELECT id FROM tree
    )`;
  }

  private static async present(
    organizationId: string,
    positions: readonly StockPosition[],
  ): Promise<StockModel["balance"][]> {
    if (positions.length === 0) return [];
    const itemIds = [...new Set(positions.map((position) => position.itemId))];
    const rows = await prisma.part.findMany({
      where: { organizationId, id: { in: itemIds } },
      select: itemColumns,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered: StockModel["balance"][] = [];
    for (const position of positions) {
      const row = byId.get(position.itemId);
      if (!row) continue;
      ordered.push(
        StockService.balance(
          row,
          {
            uuid: position.branchUuid,
            name: position.branchName,
            active: position.branchActive,
          },
          position,
        ),
      );
    }
    return ordered;
  }

  private static async presentOne(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    branch: StockBranch,
    itemId: number,
    balance: {
      stock: Prisma.Decimal;
      minimumStock: Prisma.Decimal;
      version: number;
    } | null,
  ): Promise<StockModel["balance"]> {
    const row = await db.part.findFirst({
      where: { organizationId, id: itemId },
      select: itemColumns,
    });
    if (!row) throw new createError.NotFound("Item was not found");
    return StockService.balance(row, branch, balance);
  }

  private static balance(
    row: ItemRecord,
    branch: StockBranch,
    balance: {
      stock: Prisma.Decimal | null;
      minimumStock: Prisma.Decimal | null;
      version: number | null;
    } | null,
  ): StockModel["balance"] {
    const stock = balance?.stock ?? new Decimal(0);
    const minimumStock = balance?.minimumStock ?? new Decimal(0);
    return {
      itemUuid: row.uuid,
      branchUuid: branch.uuid,
      branch,
      name: row.name,
      description: row.description,
      ipn: row.ipn,
      active: row.active,
      categoryUuid: row.category?.uuid ?? null,
      category: row.category,
      units: row.unit?.code ?? "",
      unitUuid: row.unit?.uuid ?? null,
      unit: row.unit,
      stock: stock.toString(),
      minimumStock: minimumStock.toString(),
      version: balance?.version ?? 0,
      belowMinimum: stock.lte(minimumStock),
    };
  }
}
