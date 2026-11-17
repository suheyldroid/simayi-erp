import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { TrackingFormatter } from "./formatter";
import { TrackingModel, trackingSelect } from "./model";

export abstract class TrackingService {
  static async index(
    actor: TenantActor,
    uuid: string,
    query: TrackingModel["query"],
  ): Promise<TrackingModel["list"]> {
    const organizationId = actor.organizationId;
    const item = await prisma.part.findFirst({
      where: { organizationId, uuid },
      select: { id: true },
    });
    if (!item) throw new createError.NotFound("Item was not found");
    const where: Prisma.ItemTrackingWhereInput = {
      organizationId,
      itemId: item.id,
      ...(actor.branchId == null ? {} : { branchId: actor.branchId }),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.itemTracking.findMany({
        where,
        select: trackingSelect,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.itemTracking.count({ where }),
    ]);
    return {
      items: rows.map((row) => TrackingFormatter.present(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
