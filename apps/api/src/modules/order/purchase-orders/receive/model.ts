import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../../prisma/generated/prisma/client";
import { resourceParams, resourceUuid, pageQuery } from "@/lib/dto";
import { OrderModel } from "../../model";

const receiptRequestKey = t.String({
  pattern: "^[A-Za-z0-9._:-]{8,100}$",
  maxLength: 100,
});

const receiveItem = t.Object(
  {
    lineUuid: resourceUuid,
    branchUuid: t.Optional(resourceUuid),
    quantity: OrderModel.amount,
    notes: t.Optional(t.String({ maxLength: 512 })),
  },
  { additionalProperties: false },
);

const branchSummary = t.Object(
  {
    uuid: resourceUuid,
    name: t.String({ maxLength: 100 }),
    active: t.Boolean(),
  },
  { additionalProperties: false },
);

/** Immutable delivery event plus its optional compensating reversal. */
const receipt = t.Object(
  {
    uuid: resourceUuid,
    orderUuid: resourceUuid,
    lineUuid: resourceUuid,
    branchUuid: resourceUuid,
    branch: branchSummary,
    itemUuid: t.Nullable(resourceUuid),
    quantity: t.String(),
    stockQuantity: t.Nullable(t.String()),
    unitCode: t.Nullable(t.String({ maxLength: 20 })),
    packQuantityNative: t.Nullable(t.String()),
    purchasePrice: t.Nullable(t.String()),
    discount: t.Nullable(t.String()),
    currencyCode: t.Nullable(t.String({ maxLength: 3 })),
    notes: t.Nullable(t.String({ maxLength: 512 })),
    userId: t.Nullable(t.String()),
    occurredAt: t.Nullable(t.String()),
    legacyBaseline: t.Boolean(),
    reversalOfUuid: t.Nullable(resourceUuid),
    reversalUuid: t.Nullable(resourceUuid),
  },
  { additionalProperties: false },
);

export const receiptSelect = {
  uuid: true,
  quantity: true,
  stockQuantity: true,
  unitCode: true,
  packQuantityNative: true,
  purchasePrice: true,
  discount: true,
  currencyCode: true,
  notes: true,
  userId: true,
  occurredAt: true,
  legacyBaseline: true,
  itemUuid: true,
  branch: { select: { uuid: true, name: true, active: true } },
  order: { select: { uuid: true } },
  line: { select: { uuid: true } },
  reversalOf: { select: { uuid: true } },
  reversal: { select: { uuid: true } },
} satisfies Prisma.PurchaseReceiptSelect;

export type ReceiptRecord = Prisma.PurchaseReceiptGetPayload<{
  select: typeof receiptSelect;
}>;

export const ReceiveModel = {
  params: resourceParams,
  receiptParams: t.Object({
    uuid: resourceUuid,
    receiptUuid: resourceUuid,
  }),
  body: t.Object(
    {
      version: OrderModel.version,
      requestKey: receiptRequestKey,
      items: t.Array(receiveItem, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
  reverseBody: t.Object(
    {
      version: OrderModel.version,
      notes: t.Optional(t.String({ maxLength: 512 })),
      requestKey: t.Optional(receiptRequestKey),
    },
    { additionalProperties: false },
  ),
  query: t.Object({
    ...pageQuery.properties,
    lineUuid: t.Optional(resourceUuid),
    branchUuid: t.Optional(resourceUuid),
  }),
  receipt,
  created: t.Object({
    orderVersion: OrderModel.version,
    receipts: t.Array(receipt),
  }),
  reversed: t.Object({
    orderVersion: OrderModel.version,
    receipt,
  }),
  list: t.Object({
    items: t.Array(receipt),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type ReceiveModel = {
  [K in keyof typeof ReceiveModel]: UnwrapSchema<(typeof ReceiveModel)[K]>;
};
