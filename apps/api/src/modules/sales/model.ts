import { t, type UnwrapSchema } from "elysia";
import type {
  Prisma,
  PrismaClient,
} from "../../../prisma/generated/prisma/client";
import { BuildPlain } from "../../../prisma/generated/typebox/Build";
import { BuildComponentPlain } from "../../../prisma/generated/typebox/BuildComponent";
import { BuildConsumptionPlain } from "../../../prisma/generated/typebox/BuildConsumption";
import { MoneyMovementPlain } from "../../../prisma/generated/typebox/MoneyMovement";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";
import type { EffectiveItem } from "../recipes/model";

export type Database = Prisma.TransactionClient | PrismaClient;

// Response-safe projections. Snapshot UUID refs stay immutable so sale
// history survives recipe or item deletion.
const ingredientSelect = {
  uuid: true,
  recipeLineUuidRef: true,
  componentUuidRef: true,
  componentName: true,
  componentIpn: true,
  componentUnits: true,
  recipeQuantity: true,
  requiredQuantity: true,
  consumedQuantity: true,
  note: true,
} satisfies Prisma.BuildComponentSelect;

const consumptionSelect = {
  uuid: true,
  buildComponent: { select: { uuid: true } },
  itemUuidRef: true,
  item: { select: { uuid: true } },
  quantity: true,
  quantityBefore: true,
  quantityAfter: true,
  createdAt: true,
  createdById: true,
  createdByName: true,
} satisfies Prisma.BuildConsumptionSelect;

const branchSelect = { uuid: true, name: true } satisfies Prisma.BranchSelect;

export const salesSummarySelect = {
  uuid: true,
  reference: true,
  referenceInt: true,
  requestedRecipeUuid: true,
  recipeName: true,
  recipeVersion: true,
  quantity: true,
  ingredientCount: true,
  totalPrice: true,
  currencyCode: true,
  businessDate: true,
  sourceSheet: true,
  sourceRow: true,
  sourceChannelText: true,
  sourceProductText: true,
  createdAt: true,
  createdById: true,
  createdByName: true,
  branch: { select: branchSelect },
  channel: { select: { uuid: true, name: true } },
  batch: { select: { uuid: true, reference: true } },
} satisfies Prisma.BuildSelect;

export const salesFullSelect = {
  id: true,
  unitPrice: true,
  recipeDefinitionUuid: true,
  recipeSourceVersion: true,
  ...salesSummarySelect,
  components: { select: ingredientSelect, orderBy: { id: "asc" } },
  consumptions: { select: consumptionSelect, orderBy: { id: "asc" } },
} satisfies Prisma.BuildSelect;

export type SalesSummaryRecord = Prisma.BuildGetPayload<{
  select: typeof salesSummarySelect;
}>;
export type SalesRecord = Prisma.BuildGetPayload<{
  select: typeof salesFullSelect;
}>;
/** Posted receipts of one sale, including their single reversals. */
export const saleReceiptSelect = {
  uuid: true,
  entryKind: true,
  amount: true,
  occurredAt: true,
  note: true,
  createdAt: true,
  createdById: true,
  reversalOf: { select: { uuid: true } },
  reversal: { select: { uuid: true } },
} satisfies Prisma.MoneyMovementSelect;

export type SaleReceiptRecord = Prisma.MoneyMovementGetPayload<{
  select: typeof saleReceiptSelect;
}>;

export type IngredientPlan = {
  /** The effective leaf recipe line, frozen into the sale snapshot. */
  line: { id: number; uuid: string; note: string };
  item: EffectiveItem;
  /** Effective quantity consumed per one unit of the sold root recipe. */
  recipeQuantity: Prisma.Decimal;
  required: Prisma.Decimal;
  /** Unit code captured when the plan is validated, not read again later. */
  unitCode: string;
};
export type Shortage = {
  componentName: string;
  componentUnits: string;
  required: string;
  available: string;
  missing: string;
};

const branch = t.Object(
  { uuid: resourceUuid, name: t.String({ maxLength: 100 }) },
  { additionalProperties: false },
);

const summary = t.Object({
  uuid: resourceUuid,
  reference: BuildPlain.properties.reference,
  referenceInt: t.String(),
  // The sold recipe snapshot stays available after the recipe is deleted.
  recipeUuid: resourceUuid,
  recipeName: BuildPlain.properties.recipeName,
  recipeVersion: { ...BuildPlain.properties.recipeVersion, minimum: 0 },
  quantity: { ...BuildPlain.properties.quantity, minimum: 1 },
  ingredientCount: { ...BuildPlain.properties.ingredientCount, minimum: 0 },
  branch,
  channelUuid: t.Nullable(resourceUuid),
  channelName: t.Nullable(t.String({ maxLength: 100 })),
  currencyCode: t.Nullable(t.String({ pattern: "^[A-Z]{3}$" })),
  totalPrice: t.Nullable(t.String()),
  businessDate: t.Nullable(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  batchUuid: t.Nullable(resourceUuid),
  batchReference: t.Nullable(t.String({ maxLength: 64 })),
  sourceSheet: t.Nullable(t.String({ maxLength: 200 })),
  sourceRow: t.Nullable(t.Integer({ minimum: 1 })),
  sourceChannelText: t.Nullable(t.String({ maxLength: 200 })),
  sourceProductText: t.Nullable(t.String({ maxLength: 200 })),
  createdAt: BuildPlain.properties.createdAt,
  createdById: BuildPlain.properties.createdById,
  createdByName: BuildPlain.properties.createdByName,
});

const ingredient = t.Object({
  uuid: resourceUuid,
  recipeLineUuid: resourceUuid,
  itemUuid: resourceUuid,
  itemName: BuildComponentPlain.properties.componentName,
  itemIpn: BuildComponentPlain.properties.componentIpn,
  itemUnits: BuildComponentPlain.properties.componentUnits,
  quantityPerRecipe: t.String(),
  requiredQuantity: t.String(),
  consumedQuantity: t.String(),
  note: BuildComponentPlain.properties.note,
});

const consumption = t.Object({
  uuid: resourceUuid,
  buildComponentUuid: resourceUuid,
  itemUuidRef: resourceUuid,
  itemUuid: t.Nullable(resourceUuid),
  quantity: t.String(),
  quantityBefore: t.String(),
  quantityAfter: t.String(),
  createdAt: BuildConsumptionPlain.properties.createdAt,
  createdById: BuildConsumptionPlain.properties.createdById,
  createdByName: BuildConsumptionPlain.properties.createdByName,
});

const receipt = t.Object({
  uuid: resourceUuid,
  kind: t.Union([t.Literal("receipt"), t.Literal("reversal")]),
  amount: t.String(),
  occurredAt: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  note: MoneyMovementPlain.properties.note,
  reversalOfUuid: t.Nullable(resourceUuid),
  reversed: t.Boolean(),
  createdAt: MoneyMovementPlain.properties.createdAt,
  createdById: MoneyMovementPlain.properties.createdById,
});

const sale = t.Object({
  ...summary.properties,
  unitPrice: t.Nullable(t.String()),
  /** Definition whose graph and price were frozen, once provenance existed. */
  recipeDefinitionUuid: t.Nullable(resourceUuid),
  /** Company version a branch customization was pinned at, else null. */
  recipeSourceVersion: t.Nullable(t.Integer({ minimum: 0 })),
  collectedAmount: t.Nullable(t.String()),
  outstandingAmount: t.Nullable(t.String()),
  ingredients: t.Array(ingredient),
  consumptionCount: t.Integer({ minimum: 0 }),
  consumptions: t.Array(consumption),
  receipts: t.Array(receipt),
});

export const SalesModel = {
  params: resourceParams,
  query: pageQuery,
  body: t.Object(
    {
      recipeUuid: resourceUuid,
      quantity: {
        ...BuildPlain.properties.quantity,
        minimum: 1,
        maximum: 2147483647,
      },
      channelUuid: resourceUuid,
      requestKey: {
        ...BuildPlain.properties.requestKey,
        minLength: 1,
        maxLength: 100,
        pattern: "\\S",
      },
    },
    { additionalProperties: false },
  ),
  branch,
  summary,
  ingredient,
  consumption,
  receipt,
  sale,
  list: t.Object({
    items: t.Array(summary),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type SalesModel = {
  [K in keyof typeof SalesModel]: UnwrapSchema<(typeof SalesModel)[K]>;
};
