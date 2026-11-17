import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { CatalogService } from "@/lib/catalog";
import {
  branchInUse,
  branchInactive,
  branchRequired,
  invalidBranchId,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { BranchActor, TenantActor } from "@/lib/tenant";
import { BranchesFormatter } from "./formatter";
import { branchColumns, type BranchesModel } from "./model";

type Database = Prisma.TransactionClient | typeof prisma;
type LifecycleLock = "shared" | "exclusive" | "none";
type BranchOptions = { active?: boolean; lock?: LifecycleLock };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stale = () =>
  new createError.Conflict(
    "The branch was updated by someone else. Reload and try again.",
  );

/**
 * Company branch resolution and lifecycle. The branch header is optional;
 * company endpoints work without it and no branch is ever chosen implicitly.
 */
export abstract class BranchesService {
  /**
   * Transaction-scoped advisory lifecycle lock keyed by the internal branch
   * id. Branch operational writes take it in shared mode; activation changes
   * take it in exclusive mode, so a close cannot race an in-flight write.
   * It must be the first advisory lock in the transaction.
   */
  static async lock(
    db: Database,
    branchId: number,
    mode: Exclude<LifecycleLock, "none">,
  ): Promise<void> {
    if (mode === "exclusive") {
      await db.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(814209::int, CAST(${branchId} AS int))`,
      );
      return;
    }
    await db.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock_shared(814209::int, CAST(${branchId} AS int))`,
    );
  }

  /** Resolve the optional X-Branch-Id header inside the actor organization. */
  static async resolveHeader(
    organizationId: string,
    raw: string | null,
  ): Promise<{ branchId: number | null; branchUuid: string | null }> {
    if (raw === null) return { branchId: null, branchUuid: null };
    if (!UUID.test(raw)) throw invalidBranchId();
    const branch = await prisma.branch.findFirst({
      where: { organizationId, uuid: raw },
      select: { id: true, uuid: true },
    });
    if (!branch) throw new createError.NotFound("Branch was not found");
    return { branchId: branch.id, branchUuid: branch.uuid };
  }

  /**
   * Authoritative branch scope for a write. Missing header is a client error,
   * unknown/cross-company is the same 404 as an unknown branch, and an
   * inactive branch only fails when `active` is required. The lifecycle lock
   * is taken first, then the branch row is read with `FOR SHARE`: a writer
   * whose Serializable snapshot predates a concurrent deactivation either
   * blocks and reads the committed inactive row, or fails with the standard
   * serialization conflict instead of writing into a closed branch. Callers
   * must pass the write transaction and call this first.
   */
  static async requireActor(
    db: Database,
    actor: TenantActor,
    options: BranchOptions = {},
  ): Promise<BranchActor> {
    const branchId = actor.branchId;
    if (branchId == null) throw branchRequired();
    const mode = options.lock ?? (options.active === true ? "shared" : "none");
    let branch: BranchActor["branch"] | null;
    if (mode === "none") {
      branch = await db.branch.findFirst({
        where: {
          organizationId: actor.organizationId,
          id: branchId,
          ...(actor.branchUuid === null ? {} : { uuid: actor.branchUuid }),
        },
        select: {
          id: true,
          uuid: true,
          name: true,
          active: true,
          version: true,
        },
      });
    } else {
      await BranchesService.lock(db, branchId, mode);
      branch = await BranchesService.currentBranch(
        db,
        actor.organizationId,
        branchId,
        actor.branchUuid,
      );
    }
    if (!branch) throw new createError.NotFound("Branch was not found");
    if (options.active === true && !branch.active) throw branchInactive();
    return {
      userId: actor.userId,
      organizationId: actor.organizationId,
      branchId: branch.id,
      branchUuid: branch.uuid,
      branch,
    };
  }

  /**
   * Resolve and lock an explicitly named destination branch (for example a
   * purchase receipt target) inside the caller transaction. The activation
   * check reads the row with `FOR SHARE` after the lifecycle lock, so a
   * concurrent close cannot be hidden by an older Serializable snapshot.
   */
  static async requireByUuid(
    db: Database,
    organizationId: string,
    branchUuid: string,
    options: BranchOptions = {},
  ): Promise<BranchActor["branch"]> {
    if (!UUID.test(branchUuid)) throw invalidBranchId();
    const mode = options.lock ?? (options.active === true ? "shared" : "none");
    let branch: BranchActor["branch"] | null;
    if (mode === "none") {
      branch = await db.branch.findFirst({
        where: { organizationId, uuid: branchUuid },
        select: {
          id: true,
          uuid: true,
          name: true,
          active: true,
          version: true,
        },
      });
    } else {
      const found = await db.branch.findFirst({
        where: { organizationId, uuid: branchUuid },
        select: { id: true },
      });
      if (!found) throw new createError.NotFound("Branch was not found");
      await BranchesService.lock(db, found.id, mode);
      branch = await BranchesService.currentBranch(
        db,
        organizationId,
        found.id,
        branchUuid,
      );
    }
    if (!branch) throw new createError.NotFound("Branch was not found");
    if (options.active === true && !branch.active) throw branchInactive();
    return branch;
  }

  /**
   * Current committed branch row under a row-level share lock. `FOR SHARE`
   * re-reads after waiting for the lifecycle lock holder instead of trusting
   * the transaction snapshot, and a Serializable transaction fails cleanly
   * when the row changed after its snapshot.
   */
  private static async currentBranch(
    db: Database,
    organizationId: string,
    branchId: number,
    branchUuid: string | null,
  ): Promise<BranchActor["branch"] | null> {
    const rows = await db.$queryRaw<
      Array<{
        id: number;
        uuid: string;
        name: string;
        active: boolean;
        version: number;
      }>
    >(Prisma.sql`
      SELECT "id", "uuid", "name", "active", "version"
      FROM "branch"
      WHERE "organization_id" = ${organizationId}
        AND "id" = ${branchId}
        ${branchUuid === null ? Prisma.empty : Prisma.sql`AND "uuid" = CAST(${branchUuid} AS uuid)`}
      FOR SHARE
    `);
    return rows[0] ?? null;
  }

  static async index(
    actor: TenantActor,
    query: BranchesModel["query"],
  ): Promise<BranchesModel["list"]> {
    const search = query.search?.trim();
    const active = CatalogService.flag(query.active);
    const where: Prisma.BranchWhereInput = {
      organizationId: actor.organizationId,
      ...(active === undefined ? {} : { active }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.branch.findMany({
        where,
        select: branchColumns,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.branch.count({ where }),
    ]);
    return {
      items: rows.map((row) => BranchesFormatter.toBranch(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<BranchesModel["branch"]> {
    const row = await prisma.branch.findFirst({
      where: { organizationId: actor.organizationId, uuid },
      select: branchColumns,
    });
    if (!row) throw new createError.NotFound("Branch was not found");
    return BranchesFormatter.toBranch(row);
  }

  static async store(
    actor: TenantActor,
    body: BranchesModel["body"],
  ): Promise<BranchesModel["branch"]> {
    const organizationId = actor.organizationId;
    const name = CatalogService.required(body.name);
    return prisma.$transaction(async (db) => {
      const duplicate = await db.branch.findFirst({
        where: { organizationId, name },
        select: { id: true },
      });
      if (duplicate)
        throw new createError.Conflict("Branch name is already used");
      // No stock or activation rows: active company recipes are available by default.
      const row = await db.branch.create({
        data: {
          organizationId,
          name,
          description: body.description ?? "",
        },
        select: branchColumns,
      });
      return BranchesFormatter.toBranch(row);
    });
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: BranchesModel["patch"],
  ): Promise<BranchesModel["branch"]> {
    const organizationId = actor.organizationId;
    return prisma.$transaction(
      async (db) => {
        const existing = await db.branch.findFirst({
          where: { organizationId, uuid },
          select: { id: true, version: true, active: true },
        });
        if (!existing) throw new createError.NotFound("Branch was not found");
        if (body.version !== existing.version) throw stale();
        const active = body.active;
        const toggling = active !== undefined && active !== existing.active;
        if (toggling) {
          // Close (or reopen) is serialized against every branch write, then
          // the row is re-read under a share lock so this transaction sees the
          // latest committed activation instead of its own earlier snapshot.
          await BranchesService.lock(db, existing.id, "exclusive");
          const locked = await BranchesService.currentBranch(
            db,
            organizationId,
            existing.id,
            null,
          );
          if (!locked) throw new createError.NotFound("Branch was not found");
          if (locked.version !== body.version) throw stale();
          if (active === false)
            await BranchesService.assertDeactivatable(
              db,
              organizationId,
              locked.id,
            );
        }
        const name =
          body.name === undefined
            ? undefined
            : CatalogService.required(body.name);
        if (name !== undefined) {
          const duplicate = await db.branch.findFirst({
            where: { organizationId, name, id: { not: existing.id } },
            select: { id: true },
          });
          if (duplicate)
            throw new createError.Conflict("Branch name is already used");
        }
        const saved = await db.branch.updateMany({
          where: { organizationId, id: existing.id, version: body.version },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(body.description === undefined
              ? {}
              : { description: body.description }),
            ...(active === undefined ? {} : { active }),
            version: { increment: 1 },
          },
        });
        if (saved.count !== 1) throw stale();
        const row = await db.branch.findFirst({
          where: { organizationId, id: existing.id },
          select: branchColumns,
        });
        if (!row) throw new createError.NotFound("Branch was not found");
        return BranchesFormatter.toBranch(row);
      },
      // Fresh statements after the awaited lifecycle lock; the counts that
      // gate a close must not come from a pre-wait snapshot.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /** Zero balances and no unresolved operational work can stay behind. */
  private static async assertDeactivatable(
    db: Prisma.TransactionClient,
    organizationId: string,
    branchId: number,
  ): Promise<void> {
    const [
      stockBalances,
      openPurchaseOrders,
      draftSalesBatches,
      activePosDevices,
    ] = await Promise.all([
      db.branchStock.count({
        where: { organizationId, branchId, stock: { not: 0 } },
      }),
      db.purchaseOrder.count({
        where: {
          organizationId,
          branchId,
          status: { in: [10, 20, 25] },
        },
      }),
      db.salesBatch.count({
        where: { organizationId, branchId, status: 10 },
      }),
      db.posDevice.count({
        where: { organizationId, branchId, active: true },
      }),
    ]);
    if (
      stockBalances ||
      openPurchaseOrders ||
      draftSalesBatches ||
      activePosDevices
    )
      throw branchInUse({
        stockBalances,
        openPurchaseOrders,
        draftSalesBatches,
        activePosDevices,
      });
  }
}
