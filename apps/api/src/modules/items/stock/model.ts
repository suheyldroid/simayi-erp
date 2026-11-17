import { t, type UnwrapSchema } from "elysia";
import { BranchPlain } from "../../../../prisma/generated/typebox/Branch";
import { resourceParams, resourceUuid, pageQuery } from "@/lib/dto";
import { ItemsModel, stockQuantity } from "../model";

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);

/**
 * Owning branch of one balance row. The active flag lets a company-wide list
 * render history rows of a closed branch without hiding them.
 */
const branch = t.Object(
  {
    uuid: resourceUuid,
    name: {
      ...BranchPlain.properties.name,
      minLength: 1,
      maxLength: 100,
      pattern: "\\S",
    },
    active: BranchPlain.properties.active,
  },
  { additionalProperties: false },
);

/**
 * One item's balance in one company branch. Company-wide listings use the same
 * row shape, one row per item and branch. The item identity and catalog
 * presentation columns are shared; `version` is the branch balance version and
 * never the catalog item version.
 */
const balance = t.Object(
  {
    ...t.Pick(ItemsModel.item, [
      "name",
      "description",
      "ipn",
      "active",
      "categoryUuid",
      "category",
      "units",
      "unitUuid",
      "unit",
    ]).properties,
    itemUuid: resourceUuid,
    branchUuid: resourceUuid,
    branch,
    stock: stockQuantity,
    minimumStock: t.String({
      pattern: "^\\d+(?:\\.\\d{1,6})?$",
      maxLength: 20,
    }),
    version: t.Integer({ minimum: 0 }),
    belowMinimum: t.Boolean(),
  },
  { additionalProperties: false },
);

/** Shared request body for the manual stock add, remove, and count actions. */
const body = t.Object(
  {
    quantity: stockQuantity,
    version: t.Integer({ minimum: 0 }),
    notes: t.Optional(t.String({ maxLength: 512 })),
  },
  { additionalProperties: false },
);

export const StockModel = {
  params: resourceParams,
  query: t.Object({
    ...pageQuery.properties,
    search: t.Optional(t.String({ maxLength: 100 })),
    categoryUuid: t.Optional(resourceUuid),
    subcategories: queryFlag,
    active: queryFlag,
    low: queryFlag,
  }),
  body,
  minimum: t.Object(
    {
      version: t.Integer({ minimum: 0 }),
      minimumStock: t.String({
        pattern: "^\\d+(?:\\.\\d{1,6})?$",
        maxLength: 20,
      }),
    },
    { additionalProperties: false },
  ),
  balance,
  list: t.Object({
    items: t.Array(balance),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type StockModel = {
  [K in keyof typeof StockModel]: UnwrapSchema<(typeof StockModel)[K]>;
};

export type StockOperation = "add" | "remove" | "count";
