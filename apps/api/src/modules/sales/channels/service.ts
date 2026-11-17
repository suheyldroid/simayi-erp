import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { CatalogService } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { SalesChannelsFormatter } from "./formatter";
import { channelSelect, type SalesChannelsModel } from "./model";

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export abstract class SalesChannelsService {
  static async index(
    actor: TenantActor,
    query: SalesChannelsModel["query"],
  ): Promise<SalesChannelsModel["list"]> {
    const organizationId = actor.organizationId;
    const search = query.search?.trim();
    const where: Prisma.SalesChannelWhereInput = {
      organizationId,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.salesChannel.findMany({
        where,
        select: channelSelect,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.salesChannel.count({ where }),
    ]);
    return {
      items: rows.map((row) => SalesChannelsFormatter.toChannel(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async store(
    actor: TenantActor,
    body: SalesChannelsModel["body"],
  ): Promise<SalesChannelsModel["channel"]> {
    const name = body.name.trim();
    if (name === "")
      throw new createError.UnprocessableEntity("Channel name is required");
    try {
      const row = await prisma.$transaction(async (db) => {
        await CatalogService.lockItem(db);
        return db.salesChannel.create({
          data: { organizationId: actor.organizationId, name },
          select: channelSelect,
        });
      });
      return SalesChannelsFormatter.toChannel(row);
    } catch (error) {
      if (isDuplicate(error))
        throw new createError.Conflict(
          "A sales channel with this name already exists",
        );
      throw error;
    }
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: SalesChannelsModel["patch"],
  ): Promise<SalesChannelsModel["channel"]> {
    const organizationId = actor.organizationId;
    if (body.name === undefined && body.active === undefined)
      throw new createError.UnprocessableEntity("No channel change supplied");
    const name = body.name?.trim();
    if (name === "")
      throw new createError.UnprocessableEntity("Channel name is required");
    try {
      const row = await prisma.$transaction(async (db) => {
        // Channel active/name changes share the catalog lock with batch
        // processing, so a resolved channel cannot change mid-process.
        await CatalogService.lockItem(db);
        const existing = await db.salesChannel.findFirst({
          where: { organizationId, uuid },
          select: { id: true },
        });
        if (!existing)
          throw new createError.NotFound("Sales channel was not found");
        return db.salesChannel.update({
          where: { organizationId_id: { organizationId, id: existing.id } },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(body.active === undefined ? {} : { active: body.active }),
          },
          select: channelSelect,
        });
      });
      return SalesChannelsFormatter.toChannel(row);
    } catch (error) {
      if (isDuplicate(error))
        throw new createError.Conflict(
          "A sales channel with this name already exists",
        );
      throw error;
    }
  }
}
