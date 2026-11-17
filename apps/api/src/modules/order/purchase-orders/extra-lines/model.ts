import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../../prisma/generated/prisma/client";
import { PurchaseOrderExtraLinePlain } from "../../../../../prisma/generated/typebox/PurchaseOrderExtraLine";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";
import { OrderModel } from "../../model";

// Prismabox renders Decimal columns as Number and date-only columns as ISO
// date-time; the HTTP contract keeps exact decimal strings and YYYY-MM-DD.
const line = t.Object({
  ...t.Omit(PurchaseOrderExtraLinePlain, [
    "organizationId",
    "id",
    "orderId",
    "quantity",
    "discount",
    "price",
    "targetDate",
    "context",
  ]).properties,
  uuid: resourceUuid,
  orderUuid: resourceUuid,
  quantity: t.String(),
  discount: t.String(),
  price: t.Nullable(t.String()),
  targetDate: t.Nullable(t.String()),
  context: OrderModel.jsonObject,
});

const writable = t.Partial(
  t.Object({
    description: t.String({
      ...PurchaseOrderExtraLinePlain.properties.description,
      maxLength: 250,
    }),
    quantity: OrderModel.amount,
    discount: OrderModel.discount,
    price: t.Nullable(OrderModel.price),
    line: t.String({
      ...PurchaseOrderExtraLinePlain.properties.line,
      maxLength: 20,
    }),
    reference: t.String({
      ...PurchaseOrderExtraLinePlain.properties.reference,
      maxLength: 100,
    }),
    notes: t.String({
      ...PurchaseOrderExtraLinePlain.properties.notes,
      maxLength: 500,
    }),
    link: t.String({
      ...PurchaseOrderExtraLinePlain.properties.link,
      maxLength: 2000,
    }),
    targetDate: t.Nullable(OrderModel.day),
    context: OrderModel.jsonObject,
  }),
);

export const extraLineSelect = {
  id: true,
  uuid: true,
  description: true,
  quantity: true,
  discount: true,
  price: true,
  currencyCode: true,
  line: true,
  lineInt: true,
  reference: true,
  notes: true,
  link: true,
  targetDate: true,
  context: true,
} satisfies Prisma.PurchaseOrderExtraLineSelect;

export type ExtraLinesRecord = Prisma.PurchaseOrderExtraLineGetPayload<{
  select: typeof extraLineSelect;
}>;

export const ExtraLinesModel = {
  params: resourceParams,
  itemParams: t.Object({
    uuid: resourceUuid,
    lineUuid: resourceUuid,
  }),
  query: pageQuery,
  body: t.Object(
    {
      version: OrderModel.version,
      ...writable.properties,
      quantity: OrderModel.amount,
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    { version: OrderModel.version, ...writable.properties },
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
export type ExtraLinesModel = {
  [K in keyof typeof ExtraLinesModel]: UnwrapSchema<
    (typeof ExtraLinesModel)[K]
  >;
};
