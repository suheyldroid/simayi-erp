import { t, type UnwrapSchema } from "elysia";
import type {
  Prisma,
  PrismaClient,
} from "../../../../prisma/generated/prisma/client";
import { PurchaseOrderPlain } from "../../../../prisma/generated/typebox/PurchaseOrder";
import { SupplierPlain } from "../../../../prisma/generated/typebox/Supplier";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";
import { OrderModel } from "../model";

export const purchaseOrderStatuses: ReadonlySet<number> = new Set([
  10, 20, 25, 30, 40, 50, 60,
]);

const status = t.Union([
  t.Literal(10),
  t.Literal(20),
  t.Literal(25),
  t.Literal(30),
  t.Literal(40),
  t.Literal(50),
  t.Literal(60),
]);

const supplier = t.Object({
  ...t.Pick(SupplierPlain, [
    "name",
    "contact",
    "contactPhone",
    "contactRole",
    "phone",
    "line1",
    "line2",
    "postalCode",
    "postalCity",
    "province",
    "country",
  ]).properties,
  uuid: resourceUuid,
});

// Prismabox renders Decimal columns as Number, date-only columns as ISO
// date-time, and BigInt references as Integer; the HTTP contract keeps exact
// decimal strings, YYYY-MM-DD dates, and string reference integers.
const order = t.Object({
  ...t.Omit(PurchaseOrderPlain, [
    "organizationId",
    "updatedAt",
    "id",
    "referenceInt",
    "status",
    "supplierId",
    "branchId",
    "responsibleId",
    "totalPrice",
    "startDate",
    "targetDate",
    "creationDate",
    "issueDate",
    "completeDate",
    "version",
  ]).properties,
  uuid: resourceUuid,
  referenceInt: t.String(),
  status,
  statusLabel: t.String(),
  branchUuid: t.Nullable(resourceUuid),
  branch: t.Nullable(
    t.Object({
      uuid: resourceUuid,
      name: t.String({ maxLength: 100 }),
      active: t.Boolean(),
    }),
  ),
  supplierUuid: t.Nullable(resourceUuid),
  supplier: t.Nullable(supplier),
  responsibleUuid: t.Nullable(resourceUuid),
  totalPrice: t.Nullable(t.String()),
  startDate: t.Nullable(t.String()),
  targetDate: t.Nullable(t.String()),
  creationDate: t.Nullable(t.String()),
  issueDate: t.Nullable(t.String()),
  completeDate: t.Nullable(t.String()),
  version: OrderModel.version,
});

const writable = t.Partial(
  t.Object({
    description: t.String({
      ...PurchaseOrderPlain.properties.description,
      maxLength: 250,
    }),
    link: t.String({ ...PurchaseOrderPlain.properties.link, maxLength: 2000 }),
    supplierReference: t.String({
      ...PurchaseOrderPlain.properties.supplierReference,
      maxLength: 64,
    }),
    responsibleUuid: t.Nullable(resourceUuid),
    startDate: t.Nullable(OrderModel.day),
    targetDate: t.Nullable(OrderModel.day),
    barcodeData: t.String({
      ...PurchaseOrderPlain.properties.barcodeData,
      maxLength: 500,
    }),
  }),
);

export const purchaseOrderSelect = {
  id: true,
  uuid: true,
  reference: true,
  referenceInt: true,
  description: true,
  link: true,
  status: true,
  supplierReference: true,
  totalPrice: true,
  startDate: true,
  targetDate: true,
  creationDate: true,
  issueDate: true,
  completeDate: true,
  createdById: true,
  receivedById: true,
  barcodeData: true,
  barcodeHash: true,
  version: true,
  supplierId: true,
  branch: {
    select: {
      uuid: true,
      name: true,
      active: true,
    },
  },
  responsible: {
    select: {
      uuid: true,
    },
  },
  supplier: {
    select: {
      uuid: true,
      name: true,
      contact: true,
      contactPhone: true,
      contactRole: true,
      phone: true,
      line1: true,
      line2: true,
      postalCode: true,
      postalCity: true,
      province: true,
      country: true,
    },
  },
} satisfies Prisma.PurchaseOrderSelect;

export type PurchaseOrdersRecord = Prisma.PurchaseOrderGetPayload<{
  select: typeof purchaseOrderSelect;
}>;

export type PurchaseOrdersDatabase = Prisma.TransactionClient | PrismaClient;

export const PurchaseOrdersModel = {
  params: resourceParams,
  query: t.Object({
    ...pageQuery.properties,
    supplierUuid: t.Optional(resourceUuid),
    branchUuid: t.Optional(resourceUuid),
    company: t.Optional(
      t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
    ),
    status: t.Optional(
      t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 }),
    ),
    open: t.Optional(
      t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
    ),
  }),
  body: t.Object(
    {
      supplierUuid: resourceUuid,
      reference: t.Optional(
        t.String({
          ...PurchaseOrderPlain.properties.reference,
          minLength: 1,
          maxLength: 64,
        }),
      ),
      branchUuid: t.Optional(t.Nullable(resourceUuid)),
      ...writable.properties,
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    {
      version: OrderModel.version,
      supplierUuid: t.Optional(resourceUuid),
      branchUuid: t.Optional(t.Nullable(resourceUuid)),
      ...writable.properties,
    },
    { additionalProperties: false },
  ),
  completeBody: t.Object(
    {
      version: OrderModel.version,
      acceptIncomplete: t.Optional(t.Boolean()),
    },
    { additionalProperties: false },
  ),
  order,
  list: t.Object({
    items: t.Array(order),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type PurchaseOrdersModel = {
  [K in keyof typeof PurchaseOrdersModel]: UnwrapSchema<
    (typeof PurchaseOrdersModel)[K]
  >;
};
