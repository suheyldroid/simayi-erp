import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { withoutKeys } from "@/lib/publish";
import { mediaPurpose } from "@/modules/media/model";
import { MediaFilesService } from "@/modules/media/service";
import type { SupplierDatabase, SupplierModel, SupplierRecord } from "./model";

export abstract class SupplierService {
  /** Public UUID boundary; cross-organization UUIDs stay invisible. */
  static async loadByUuid(
    db: SupplierDatabase,
    organizationId: string,
    uuid: string,
  ) {
    const supplier = await db.supplier.findFirst({
      where: { organizationId, uuid },
    });
    if (!supplier) throw new createError.NotFound("Supplier not found");
    return supplier;
  }

  /** Drops internal identity and tenant columns from the public projection. */
  static present(row: SupplierRecord): SupplierModel["supplier"] {
    return withoutKeys(row, ["id", "organizationId"]);
  }

  static async index(actor: TenantActor, query: SupplierModel["query"]) {
    const active = CatalogService.flag(query.active);
    const where: Prisma.SupplierWhereInput = {
      organizationId: actor.organizationId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { contact: { contains: query.search, mode: "insensitive" } },
              { contactPhone: { contains: query.search, mode: "insensitive" } },
              { contactRole: { contains: query.search, mode: "insensitive" } },
              { postalCity: { contains: query.search, mode: "insensitive" } },
              { country: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(active === undefined ? {} : { active }),
    };
    const [items, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { name: "asc" },
      }),
      prisma.supplier.count({ where }),
    ]);
    return {
      items: items.map((row) => SupplierService.present(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(actor: TenantActor, uuid: string) {
    return SupplierService.present(
      await SupplierService.loadByUuid(prisma, actor.organizationId, uuid),
    );
  }

  static write<T>(operation: (db: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction((db) => operation(db), {
      isolationLevel: "Serializable",
    });
  }

  static store(actor: TenantActor, body: SupplierModel["body"]) {
    return SupplierService.write(async (db) => {
      const image = CatalogService.blankToNull(body.image);
      const supplier = await db.supplier.create({
        data: {
          organizationId: actor.organizationId,
          name: CatalogService.required(body.name),
          description: CatalogService.required(body.description),
          phone: body.phone,
          contact: body.contact,
          contactPhone: body.contactPhone,
          contactRole: body.contactRole,
          image,
          active: body.active,
          taxId: body.taxId,
          line1: body.line1,
          line2: body.line2,
          postalCode: body.postalCode,
          postalCity: body.postalCity,
          province: body.province,
          country: body.country,
          shippingNotes: body.shippingNotes,
          internalShippingNotes: body.internalShippingNotes,
          addressLink: body.addressLink,
        },
      });
      if (image !== null)
        await MediaFilesService.claimImage(
          db,
          actor,
          mediaPurpose.supplierImage,
          image,
          supplier.uuid,
        );
      return SupplierService.present(supplier);
    });
  }

  static update(
    actor: TenantActor,
    uuid: string,
    body: SupplierModel["patch"],
  ) {
    return SupplierService.write(async (db) => {
      const existing = await SupplierService.loadByUuid(
        db,
        actor.organizationId,
        uuid,
      );
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
            mediaPurpose.supplierImage,
            uuid,
          );
        if (image !== null)
          await MediaFilesService.claimImage(
            db,
            actor,
            mediaPurpose.supplierImage,
            image,
            uuid,
          );
      }
      const supplier = await db.supplier.update({
        where: {
          organizationId_id: {
            organizationId: actor.organizationId,
            id: existing.id,
          },
        },
        data: {
          name:
            body.name === undefined
              ? undefined
              : CatalogService.required(body.name),
          description:
            body.description === undefined
              ? undefined
              : CatalogService.required(body.description),
          phone: body.phone,
          contact: body.contact,
          contactPhone: body.contactPhone,
          contactRole: body.contactRole,
          image: body.image === undefined ? undefined : image,
          active: body.active,
          taxId: body.taxId,
          line1: body.line1,
          line2: body.line2,
          postalCode: body.postalCode,
          postalCity: body.postalCity,
          province: body.province,
          country: body.country,
          shippingNotes: body.shippingNotes,
          internalShippingNotes: body.internalShippingNotes,
          addressLink: body.addressLink,
        },
      });
      return SupplierService.present(supplier);
    });
  }

  static destroy(actor: TenantActor, uuid: string) {
    return SupplierService.write(async (db) => {
      const existing = await SupplierService.loadByUuid(
        db,
        actor.organizationId,
        uuid,
      );
      // Financial history is append-only. A supplier with ledger entries or
      // posted payments cannot be deleted, so the ledger and its supplier name
      // stay readable; a purchase order without postings may still lose its
      // supplier reference through its own foreign key.
      const [ledgerEntries, movements] = await Promise.all([
        db.supplierLedgerEntry.count({
          where: {
            organizationId: actor.organizationId,
            supplierId: existing.id,
          },
        }),
        db.moneyMovement.count({
          where: {
            organizationId: actor.organizationId,
            supplierId: existing.id,
          },
        }),
      ]);
      if (ledgerEntries > 0 || movements > 0)
        throw new createError.Conflict(
          "This supplier has finance history and cannot be deleted",
        );
      await db.supplier.delete({
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
          mediaPurpose.supplierImage,
          uuid,
        );
      return { success: true as const };
    });
  }
}
