import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { PartPlain } from "../../../prisma/generated/typebox/Part";
import { PartCategoryPlain } from "../../../prisma/generated/typebox/PartCategory";
import { UnitPlain } from "../../../prisma/generated/typebox/Unit";
import {
  pageQuery,
  resourceParams,
  resourceUuid,
  successBody,
} from "@/lib/dto";

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);
const nullableUuid = t.Nullable(resourceUuid);
/** Canonical stock balance: at most 15 integer digits and 5 fraction digits. */
export const stockDecimalText = {
  pattern: "^\\d+(?:\\.\\d{1,5})?$",
  maxLength: 21,
};
export const stockQuantity = t.String(stockDecimalText);

const summary = t.Object({
  uuid: resourceUuid,
  ...t.Pick(PartCategoryPlain, ["name", "pathstring"]).properties,
});

/** The assigned catalog unit, or null when a legacy item is unresolved. */
const unit = t.Object(
  {
    uuid: resourceUuid,
    name: { ...UnitPlain.properties.name, maxLength: 100 },
    code: { ...UnitPlain.properties.code, maxLength: 20 },
    active: UnitPlain.properties.active,
    divisible: UnitPlain.properties.divisible,
    version: { ...UnitPlain.properties.version, minimum: 0 },
  },
  { additionalProperties: false },
);

/** Presentation columns aligned with the response and formatter. */
export const itemColumns = {
  id: true,
  uuid: true,
  name: true,
  description: true,
  categoryId: true,
  unitId: true,
  image: true,
  ipn: true,
  defaultExpiry: true,
  active: true,
  creationDate: true,
  creationUserId: true,
  version: true,
  category: { select: { uuid: true, name: true, pathstring: true } },
  _count: { select: { purchaseReceipts: true } },
  unit: {
    select: {
      uuid: true,
      name: true,
      code: true,
      active: true,
      divisible: true,
      version: true,
    },
  },
} as const satisfies Prisma.PartSelect;

export type ItemRecord = Prisma.PartGetPayload<{ select: typeof itemColumns }>;

const published = t.Pick(PartPlain, [
  "name",
  "description",
  "image",
  "ipn",
  "defaultExpiry",
  "active",
  "creationDate",
  "creationUserId",
  "version",
]);

const item = t.Object(
  {
    ...published.properties,
    uuid: resourceUuid,
    name: { ...published.properties.name, maxLength: 100 },
    description: { ...published.properties.description, maxLength: 250 },
    categoryUuid: nullableUuid,
    units: t.String({ maxLength: 20 }),
    unitUuid: nullableUuid,
    unit: t.Nullable(unit),
    image: t.Nullable(t.String({ maxLength: 100 })),
    ipn: t.Nullable(t.String({ maxLength: 100 })),
    defaultExpiry: { ...published.properties.defaultExpiry, minimum: 0 },
    // Day-only dates keep the existing HTTP contract.
    creationDate: t.Nullable(t.String()),
    version: { ...published.properties.version, minimum: 0 },
    // Immutable receipt history blocks deletion even when net received is 0.
    hasReceipts: t.Boolean(),
    category: t.Nullable(summary),
  },
  { additionalProperties: false },
);

const writable = {
  name: {
    ...PartPlain.properties.name,
    minLength: 1,
    maxLength: 100,
    pattern: "\\S",
  },
  description: t.Optional({
    ...PartPlain.properties.description,
    maxLength: 250,
  }),
  categoryUuid: t.Optional(nullableUuid),
  unitUuid: resourceUuid,
  image: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
  ipn: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
  defaultExpiry: t.Optional({
    ...PartPlain.properties.defaultExpiry,
    minimum: 0,
    maximum: 2147483647,
  }),
  active: t.Optional(PartPlain.properties.active),
};

export const ItemsModel = {
  params: resourceParams,
  success: successBody,
  query: t.Object({
    ...pageQuery.properties,
    categoryUuid: t.Optional(resourceUuid),
    subcategories: queryFlag,
    active: queryFlag,
  }),
  body: t.Object(writable, { additionalProperties: false }),
  patch: t.Object(
    {
      version: { ...PartPlain.properties.version, minimum: 0 },
      ...t.Partial(t.Object(writable)).properties,
    },
    { additionalProperties: false },
  ),
  item,
  list: t.Object({
    items: t.Array(item),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type ItemsModel = {
  [K in keyof typeof ItemsModel]: UnwrapSchema<(typeof ItemsModel)[K]>;
};
