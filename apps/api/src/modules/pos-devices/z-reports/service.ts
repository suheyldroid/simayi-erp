import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { BranchesService } from "@/modules/branches/service";
import { decimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { OrderService } from "../../order/service";
import { salesBatchStatus } from "../../sales/batches/model";
import { SystemPreferencesService } from "../../system-preferences/service";
import { PosDeviceZReportsFormatter } from "./formatter";
import { zReportColumns, type PosDeviceZReportsModel } from "./model";

type Database = Prisma.TransactionClient | typeof prisma;
type ReportInput =
  PosDeviceZReportsModel["body"] | PosDeviceZReportsModel["patch"];

/**
 * A Z report derives its branch from the device and may only reconcile a batch
 * of that same branch. The device link is immutable, so the derived branch can
 * never drift; the database repeats the batch/device branch equality as a
 * trigger, and the report itself stores no branch column.
 */
export abstract class PosDeviceZReportsService {
  /**
   * The one sales batch this request may link, or null for an unmatched
   * report. Only a processed batch of the same branch is accepted; a draft has
   * no recorded sales to reconcile against, and a batch of another branch is
   * reported exactly like an unknown batch so its UUID cannot be probed.
   */
  private static async salesBatchId(
    db: Database,
    organizationId: string,
    branchId: number,
    uuid: string | null,
  ): Promise<number | null> {
    if (uuid === null) return null;
    const batch = await db.salesBatch.findFirst({
      where: { organizationId, branchId, uuid },
      select: { id: true, status: true },
    });
    if (!batch) throw new createError.NotFound("Sales batch was not found");
    if (batch.status !== salesBatchStatus.processed)
      throw new createError.UnprocessableEntity(
        "Only a processed sales batch can be linked to a Z report",
      );
    return batch.id;
  }

  private static async deviceId(
    db: Database,
    organizationId: string,
    branchId: number,
    uuid: string,
  ): Promise<number> {
    const device = await db.posDevice.findFirst({
      where: { organizationId, branchId, uuid },
      select: { id: true },
    });
    if (!device) throw new createError.NotFound("POS device was not found");
    return device.id;
  }

  private static fields(body: ReportInput): {
    reportNumber: string;
    businessDate: Date;
    closedAt: Date;
    totalAmount: Prisma.Decimal;
    note: string;
  } {
    const reportNumber = body.reportNumber.trim();
    if (reportNumber === "")
      throw new createError.UnprocessableEntity("A report number is required");
    const closedAt = new Date(body.closedAt);
    if (Number.isNaN(closedAt.getTime()))
      throw new createError.UnprocessableEntity(
        "Expected a timezone-qualified ISO date-time",
      );
    const totalAmount = decimal(body.totalAmount.trim(), 6, 13);
    if (totalAmount.isNegative())
      throw new createError.UnprocessableEntity(
        "The total amount cannot be negative",
      );
    return {
      reportNumber,
      businessDate: OrderService.day(body.businessDate),
      closedAt,
      totalAmount,
      note: body.note.trim(),
    };
  }

  static async index(
    actor: TenantActor,
    query: PosDeviceZReportsModel["query"],
  ): Promise<PosDeviceZReportsModel["list"]> {
    const organizationId = actor.organizationId;
    const search = query.search?.trim();
    // Company context aggregates every report of the organization; a verified
    // branch header narrows through the immutable device link. The optional
    // device/batch selectors only narrow the already company-scoped list.
    const deviceScope =
      actor.branchId === null && query.posDeviceUuid === undefined
        ? {}
        : {
            posDevice: {
              is: {
                organizationId,
                ...(actor.branchId === null
                  ? {}
                  : { branchId: actor.branchId }),
                ...(query.posDeviceUuid === undefined
                  ? {}
                  : { uuid: query.posDeviceUuid }),
              },
            },
          };
    const where: Prisma.PosDeviceZReportWhereInput = {
      organizationId,
      ...deviceScope,
      ...(query.salesBatchUuid
        ? {
            salesBatch: {
              is: { organizationId, uuid: query.salesBatchUuid },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { reportNumber: { contains: search, mode: "insensitive" } },
              { note: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.posDeviceZReport.findMany({
        where,
        select: zReportColumns,
        orderBy: [{ businessDate: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.posDeviceZReport.count({ where }),
    ]);
    return {
      items: rows.map((row) => PosDeviceZReportsFormatter.toReport(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    deviceUuid: string,
    uuid: string,
  ): Promise<PosDeviceZReportsModel["report"]> {
    // The device path segment still identifies the producing device, but a
    // company context may read a uniquely identified report of any branch so
    // the client can navigate to its canonical branch. A branch context stays
    // restricted to its own devices.
    const row = await prisma.posDeviceZReport.findFirst({
      where: {
        organizationId: actor.organizationId,
        uuid,
        posDevice: {
          is: {
            organizationId: actor.organizationId,
            uuid: deviceUuid,
            ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
          },
        },
      },
      select: zReportColumns,
    });
    if (!row) throw new createError.NotFound("Z report was not found");
    return PosDeviceZReportsFormatter.toReport(row);
  }

  static async store(
    actor: TenantActor,
    deviceUuid: string,
    body: PosDeviceZReportsModel["body"],
  ): Promise<PosDeviceZReportsModel["report"]> {
    const organizationId = actor.organizationId;
    try {
      return await prisma.$transaction(async (db) => {
        // Authoritative branch guard first, inside the report transaction.
        const branch = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        const posDeviceId = await PosDeviceZReportsService.deviceId(
          db,
          organizationId,
          branch.branchId,
          deviceUuid,
        );
        const salesBatchId = await PosDeviceZReportsService.salesBatchId(
          db,
          organizationId,
          branch.branchId,
          body.salesBatchUuid,
        );
        // Read-only system snapshot: no organization finance row is created.
        const currencyCode = await SystemPreferencesService.requireCurrency(db);
        const row = await db.posDeviceZReport.create({
          data: {
            organizationId,
            posDeviceId,
            salesBatchId,
            currencyCode,
            ...PosDeviceZReportsService.fields(body),
          },
          select: zReportColumns,
        });
        return PosDeviceZReportsFormatter.toReport(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new createError.Conflict(
          "A Z report with this report number already exists for this POS device",
        );
      throw error;
    }
  }

  static async update(
    actor: TenantActor,
    deviceUuid: string,
    uuid: string,
    body: PosDeviceZReportsModel["patch"],
  ): Promise<PosDeviceZReportsModel["report"]> {
    const organizationId = actor.organizationId;
    try {
      // One transaction so the branch guard, the CAS write and the returned
      // row describe this commit. The row lock held by the CAS keeps another
      // versioned writer from committing a newer version before this read; a
      // stale version still fails with 409 before any write.
      return await prisma.$transaction(async (db) => {
        const branch = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        const posDeviceId = await PosDeviceZReportsService.deviceId(
          db,
          organizationId,
          branch.branchId,
          deviceUuid,
        );
        const existing = await db.posDeviceZReport.findFirst({
          where: { organizationId, uuid, posDeviceId },
          select: { id: true, version: true },
        });
        if (!existing) throw new createError.NotFound("Z report was not found");
        if (body.version !== existing.version)
          throw new createError.Conflict(
            "The Z report was updated by someone else. Reload and try again.",
          );
        const salesBatchId = await PosDeviceZReportsService.salesBatchId(
          db,
          organizationId,
          branch.branchId,
          body.salesBatchUuid,
        );
        const saved = await db.posDeviceZReport.updateMany({
          where: {
            id: existing.id,
            organizationId,
            posDeviceId,
            version: existing.version,
          },
          data: {
            salesBatchId,
            ...PosDeviceZReportsService.fields(body),
            version: { increment: 1 },
          },
        });
        if (saved.count !== 1)
          throw new createError.Conflict(
            "The Z report was updated by someone else. Reload and try again.",
          );
        const row = await db.posDeviceZReport.findFirst({
          where: { id: existing.id, organizationId, posDeviceId },
          select: zReportColumns,
        });
        if (!row) throw new createError.NotFound("Z report was not found");
        // The currency snapshot, the device link and therefore the report
        // branch are intentionally not writable.
        return PosDeviceZReportsFormatter.toReport(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new createError.Conflict(
          "A Z report with this report number already exists for this POS device",
        );
      throw error;
    }
  }
}
