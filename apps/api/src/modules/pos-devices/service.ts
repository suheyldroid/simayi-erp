import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { BranchesService } from "@/modules/branches/service";
import { CatalogService } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { PosDevicesFormatter } from "./formatter";
import { posDeviceColumns, type PosDevicesModel } from "./model";

function writable(body: PosDevicesModel["body"] | PosDevicesModel["patch"]): {
  name: string;
  bankName: string;
  terminalId: string;
  active: boolean;
} {
  return {
    name: CatalogService.required(body.name),
    bankName: CatalogService.required(body.bankName),
    terminalId: CatalogService.required(body.terminalId),
    active: body.active,
  };
}

const staleVersion =
  "The POS device was updated by someone else. Reload and try again.";

export abstract class PosDevicesService {
  /**
   * Devices are branch-owned, but a company session lists every device of the
   * organization; a verified branch header narrows the list to that branch.
   * Reads accept an inactive branch (history stays visible); only the write
   * paths ask for an active one and every device keeps its owning branch.
   */
  static async index(
    actor: TenantActor,
    query: PosDevicesModel["query"],
  ): Promise<PosDevicesModel["list"]> {
    const search = query.search?.trim();
    const where: Prisma.PosDeviceWhereInput = {
      organizationId: actor.organizationId,
      ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { bankName: { contains: search, mode: "insensitive" } },
              { terminalId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.posDevice.findMany({
        where,
        select: posDeviceColumns,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.posDevice.count({ where }),
    ]);
    return {
      items: rows.map((row) => PosDevicesFormatter.toDevice(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<PosDevicesModel["device"]> {
    // Company context resolves a uniquely identified device anywhere in the
    // organization so the client can navigate to its canonical branch; a
    // branch context still only sees its own devices.
    const row = await prisma.posDevice.findFirst({
      where: {
        organizationId: actor.organizationId,
        ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
        uuid,
      },
      select: posDeviceColumns,
    });
    if (!row) throw new createError.NotFound("POS device was not found");
    return PosDevicesFormatter.toDevice(row);
  }

  static async store(
    actor: TenantActor,
    body: PosDevicesModel["body"],
  ): Promise<PosDevicesModel["device"]> {
    return prisma.$transaction(async (db) => {
      // Authoritative branch guard first: it resolves the branch inside this
      // transaction and takes the shared lifecycle lock, so a concurrent
      // deactivation cannot commit between this write and its commit.
      const branch = await BranchesService.requireActor(db, actor, {
        active: true,
      });
      const row = await db.posDevice.create({
        data: {
          organizationId: actor.organizationId,
          branchId: branch.branchId,
          ...writable(body),
        },
        select: posDeviceColumns,
      });
      return PosDevicesFormatter.toDevice(row);
    });
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: PosDevicesModel["patch"],
  ): Promise<PosDevicesModel["device"]> {
    const organizationId = actor.organizationId;
    // One transaction so the branch guard, the CAS write and the returned row
    // describe this commit; the stale-version 409 is preserved before any
    // write. The branch itself is never writable.
    return prisma.$transaction(async (db) => {
      const branch = await BranchesService.requireActor(db, actor, {
        active: true,
      });
      const existing = await db.posDevice.findFirst({
        where: {
          organizationId,
          branchId: branch.branchId,
          uuid,
        },
        select: { id: true, version: true },
      });
      if (!existing) throw new createError.NotFound("POS device was not found");
      if (body.version !== existing.version)
        throw new createError.Conflict(staleVersion);
      const saved = await db.posDevice.updateMany({
        where: {
          id: existing.id,
          organizationId,
          branchId: branch.branchId,
          version: existing.version,
        },
        data: { ...writable(body), version: { increment: 1 } },
      });
      if (saved.count !== 1) throw new createError.Conflict(staleVersion);
      const row = await db.posDevice.findFirst({
        where: { id: existing.id, organizationId, branchId: branch.branchId },
        select: posDeviceColumns,
      });
      if (!row) throw new createError.NotFound("POS device was not found");
      return PosDevicesFormatter.toDevice(row);
    });
  }
}
