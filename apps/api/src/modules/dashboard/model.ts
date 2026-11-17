import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { PartPlain } from "../../../prisma/generated/typebox/Part";
import { resourceUuid } from "@/lib/dto";

const count = t.Integer({ minimum: 0 });
const month = t.String({ pattern: "^\\d{4}-(?:0[1-9]|1[0-2])$" });
// Exact decimal strings at the HTTP boundary; Prismabox renders Decimal as Number.
const stockText = t.String({
  pattern: "^\\d+(?:\\.\\d{1,5})?$",
  maxLength: 21,
});
const minimumStockText = t.String({
  pattern: "^\\d+(?:\\.\\d{1,6})?$",
  maxLength: 20,
});

const monthTotals = t.Object(
  { month, users: count, organizations: count, sales: count, purchases: count },
  { additionalProperties: false },
);

const system = t.Object(
  {
    totals: t.Object(
      {
        users: count,
        organizations: count,
        sales: count,
        purchases: count,
      },
      { additionalProperties: false },
    ),
    months: t.Array(monthTotals, { minItems: 6, maxItems: 6 }),
  },
  { additionalProperties: false },
);

const alertItem = t.Object(
  {
    uuid: resourceUuid,
    ...t.Pick(PartPlain, ["name", "ipn"]).properties,
    units: t.Nullable(t.String({ maxLength: 20 })),
    stock: stockText,
    minimumStock: minimumStockText,
    organizationName: t.String(),
    organizationSlug: t.String(),
    // The balance is branch-owned, so one shared item can alert in several
    // branches. Both identities are required to open the correct stock page.
    branchUuid: resourceUuid,
    branchName: t.String({ maxLength: 100 }),
  },
  { additionalProperties: false },
);

const personal = t.Object(
  {
    totals: t.Object(
      { sales: count, purchases: count },
      { additionalProperties: false },
    ),
    alerts: t.Object(
      { total: count, items: t.Array(alertItem, { maxItems: 8 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const DashboardModel = { system, personal } as const;
export type DashboardModel = {
  [K in keyof typeof DashboardModel]: UnwrapSchema<(typeof DashboardModel)[K]>;
};

export type SystemTotalsRow = DashboardModel["system"]["totals"];

export interface MonthlyCountRow {
  metric: "users" | "organizations" | "sales" | "purchases";
  month: string;
  count: number;
}

/** Alert DTO with only the raw Decimal transport values left as database types. */
export type AlertRow = Omit<
  DashboardModel["personal"]["alerts"]["items"][number],
  "stock" | "minimumStock"
> & {
  stock: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
};

/**
 * Personal dashboard layout DTOs. Widget ids are client-generated UUIDs inside
 * the saved JSON definition; they are never rows in a business table.
 */
export const widgetTypeSchema = t.Union([
  t.Literal("kpi"),
  t.Literal("column"),
  t.Literal("bar"),
  t.Literal("line"),
  t.Literal("donut"),
]);
export type DashboardWidgetType = UnwrapSchema<typeof widgetTypeSchema>;

export const dashboardSourceSchema = t.Union([
  t.Literal("sales"),
  t.Literal("purchases"),
  t.Literal("stock"),
]);
export type DashboardSource = UnwrapSchema<typeof dashboardSourceSchema>;

export const dashboardDateRangeSchema = t.Union([
  t.Literal("last_30_days"),
  t.Literal("last_90_days"),
  t.Literal("last_6_months"),
  t.Literal("last_12_months"),
  t.Literal("all_time"),
]);
export type DashboardDateRange = UnwrapSchema<typeof dashboardDateRangeSchema>;

export const dashboardGranularitySchema = t.Union([
  t.Literal("day"),
  t.Literal("week"),
  t.Literal("month"),
]);
export type DashboardGranularity = UnwrapSchema<
  typeof dashboardGranularitySchema
>;

/**
 * A dashboard row is four columns wide; `x` is the starting column and `w` the
 * column count. `y` and `h` are row coordinates: `x`/`w` are bounded by the four
 * physical columns, while `y`/`h` only have to be safe integers, with no
 * per-type, per-card or presentation cap. Geometry checks never allocate or
 * iterate per occupied cell.
 */
export const dashboardGridColumns = 4;

export const dashboardWidgetSchema = t.Object(
  {
    id: resourceUuid,
    type: widgetTypeSchema,
    title: t.String({ minLength: 1, maxLength: 80 }),
    x: t.Integer({ minimum: 0, maximum: dashboardGridColumns - 1 }),
    y: t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    w: t.Integer({ minimum: 1, maximum: dashboardGridColumns }),
    h: t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    source: dashboardSourceSchema,
    measure: t.String({ minLength: 1, maxLength: 40 }),
    groupBy: t.Union([t.String({ minLength: 1, maxLength: 40 }), t.Null()]),
    seriesBy: t.Union([t.Literal("status"), t.Null()]),
    dateRange: t.Union([dashboardDateRangeSchema, t.Null()]),
    filters: t.Object(
      { statuses: t.Array(t.Integer({ minimum: 0 }), { maxItems: 7 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type DashboardWidget = UnwrapSchema<typeof dashboardWidgetSchema>;

export const dashboardDefinitionSchema = t.Object(
  {
    version: t.Literal(3),
    widgets: t.Array(dashboardWidgetSchema, { maxItems: 24 }),
  },
  { additionalProperties: false },
);
export type DashboardDefinition = UnwrapSchema<
  typeof dashboardDefinitionSchema
>;

export const maxDashboardWidgets = 24;

export const dashboardWidgetTypes: DashboardWidgetType[] = [
  "kpi",
  "column",
  "bar",
  "line",
  "donut",
];
export const dashboardSources: DashboardSource[] = [
  "sales",
  "purchases",
  "stock",
];
export const dashboardDateRanges: DashboardDateRange[] = [
  "last_30_days",
  "last_90_days",
  "last_6_months",
  "last_12_months",
  "all_time",
];
