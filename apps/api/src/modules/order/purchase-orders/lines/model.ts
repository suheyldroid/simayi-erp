import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../../prisma/generated/prisma/client";
import { PartPlain } from "../../../../../prisma/generated/typebox/Part";
import { PurchaseOrderLineItemPlain } from "../../../../../prisma/generated/typebox/PurchaseOrderLineItem";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";
import { OrderModel } from "../../model";

const item = t.Object({
  ...t.Pick(PartPlain, ["name", "ipn"]).properties,
  uuid: resourceUuid,
});

// Prismabox renders Decimal columns as Number and date-only columns as ISO
// date-time; the HTTP contract keeps exact decimal strings and YYYY-MM-DD.
const line = t.Object({
  ...t.Omit(PurchaseOrderLineItemPlain, [
    "organizationId",
    "id",
    "orderId",
    "itemId",
    "packQuantityNative",
    "quantity",
    "received",
    "discount",
    "purchasePrice",
    "targetDate",
  ]).properties,
  uuid: resourceUuid,
  orderUuid: resourceUuid,
  itemUuid: t.Nullable(resourceUuid),
  item: t.Nullable(item),
  packQuantityNative: t.Nullable(t.String()),
  quantity: t.String(),
  received: t.String(),
  discount: t.String(),
  purchasePrice: t.Nullable(t.String()),
  targetDate: t.Nullable(t.String()),
  // Immutable receipt history: a fully reversed line has received = 0 but
  // still cannot be deleted or have its item changed.
  receiptEventCount: t.Integer({ minimum: 0 }),
});

const writable = t.Partial(
  t.Object({
    quantity: OrderModel.amount,
    discount: OrderModel.discount,
    purchasePrice: t.Nullable(OrderModel.price),
    line: t.String({
      ...PurchaseOrderLineItemPlain.properties.line,
      maxLength: 20,
    }),
    reference: t.String({
      ...PurchaseOrderLineItemPlain.properties.reference,
      maxLength: 100,
    }),
    notes: t.String({
      ...PurchaseOrderLineItemPlain.properties.notes,
      maxLength: 500,
    }),
    link: t.String({
      ...PurchaseOrderLineItemPlain.properties.link,
      maxLength: 2000,
    }),
    targetDate: t.Nullable(OrderModel.day),
  }),
);

export const lineSelect = {
  id: true,
  uuid: true,
  itemId: true,
  packQuantityNative: true,
  unitCode: true,
  quantity: true,
  received: true,
  discount: true,
  purchasePrice: true,
  currencyCode: true,
  line: true,
  lineInt: true,
  reference: true,
  notes: true,
  link: true,
  targetDate: true,
  _count: { select: { receipts: true } },
  item: {
    select: {
      uuid: true,
      name: true,
      ipn: true,
    },
  },
} satisfies Prisma.PurchaseOrderLineItemSelect;

export type LinesRecord = Prisma.PurchaseOrderLineItemGetPayload<{
  select: typeof lineSelect;
}>;

export const LinesModel = {
  params: resourceParams,
  itemParams: t.Object({
    uuid: resourceUuid,
    lineUuid: resourceUuid,
  }),
  query: pageQuery,
  body: t.Object(
    {
      version: OrderModel.version,
      itemUuid: resourceUuid,
      ...writable.properties,
      quantity: OrderModel.amount,
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    {
      version: OrderModel.version,
      itemUuid: t.Optional(resourceUuid),
      ...writable.properties,
    },
    { additionalProperties: false },
  ),
  line,
  list: t.Object({
    items: t.Array(line),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  success: OrderModel.success,
  removeQuery: t.Object({
    version: t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 }),
  }),
} as const;
export type LinesModel = {
  [K in keyof typeof LinesModel]: UnwrapSchema<(typeof LinesModel)[K]>;
};
