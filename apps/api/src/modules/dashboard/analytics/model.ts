import { resourceUuid } from "@/lib/dto";
import { t, type UnwrapSchema } from "elysia";
import {
  dashboardDateRangeSchema,
  dashboardGranularitySchema,
  dashboardSourceSchema,
  dashboardWidgetSchema,
  maxDashboardWidgets,
  widgetTypeSchema,
} from "../model";

export const catalogMeasureSchema = t.Object(
  {
    id: t.String({ minLength: 1, maxLength: 40 }),
    label: t.String(),
    unitLabel: t.String(),
  },
  { additionalProperties: false },
);
export type CatalogMeasure = UnwrapSchema<typeof catalogMeasureSchema>;

export const catalogGroupBySchema = t.Object(
  {
    id: t.String({ minLength: 1, maxLength: 40 }),
    label: t.String(),
    temporal: t.Boolean(),
    granularity: t.Union([dashboardGranularitySchema, t.Null()]),
    allowedTypes: t.Array(widgetTypeSchema),
    allowedRanges: t.Array(dashboardDateRangeSchema),
  },
  { additionalProperties: false },
);
export type CatalogGroupBy = UnwrapSchema<typeof catalogGroupBySchema>;

export const catalogFilterOptionSchema = t.Object(
  { value: t.Integer({ minimum: 0 }), label: t.String() },
  { additionalProperties: false },
);
export type CatalogFilterOption = UnwrapSchema<
  typeof catalogFilterOptionSchema
>;

export const catalogFilterSchema = t.Object(
  {
    id: t.Literal("statuses"),
    label: t.String(),
    options: t.Array(catalogFilterOptionSchema),
  },
  { additionalProperties: false },
);
export type CatalogFilter = UnwrapSchema<typeof catalogFilterSchema>;

export const catalogSeriesSchema = t.Object(
  { id: t.Literal("status"), label: t.String() },
  { additionalProperties: false },
);
export type CatalogSeries = UnwrapSchema<typeof catalogSeriesSchema>;

export const catalogSourceSchema = t.Object(
  {
    id: dashboardSourceSchema,
    label: t.String(),
    dateBasis: t.Union([t.String(), t.Null()]),
    dateRanges: t.Array(dashboardDateRangeSchema),
    measures: t.Array(catalogMeasureSchema),
    groupBys: t.Array(catalogGroupBySchema),
    series: t.Array(catalogSeriesSchema),
    filters: t.Array(catalogFilterSchema),
    types: t.Array(widgetTypeSchema),
  },
  { additionalProperties: false },
);
export type CatalogSource = UnwrapSchema<typeof catalogSourceSchema>;

export const dashboardCatalogSchema = t.Object(
  {
    scope: t.Union([t.Literal("global"), t.Literal("organization")]),
    schemaVersion: t.Literal(3),
    maxWidgets: t.Integer({ minimum: 1 }),
    widgetTypes: t.Array(
      t.Object(
        { id: widgetTypeSchema, label: t.String() },
        { additionalProperties: false },
      ),
    ),
    dateRanges: t.Array(
      t.Object(
        { id: dashboardDateRangeSchema, label: t.String() },
        { additionalProperties: false },
      ),
    ),
    sources: t.Array(catalogSourceSchema),
  },
  { additionalProperties: false },
);
export type DashboardCatalog = UnwrapSchema<typeof dashboardCatalogSchema>;
export type CatalogScope = DashboardCatalog["scope"];

const resultSeries = t.Object(
  {
    key: t.String(),
    label: t.String(),
    values: t.Array(t.Integer({ minimum: 0 }), { maxItems: 60 }),
  },
  { additionalProperties: false },
);

const result = t.Object(
  {
    id: resourceUuid,
    type: widgetTypeSchema,
    measure: t.String(),
    measureLabel: t.String(),
    unitLabel: t.String(),
    total: t.Integer({ minimum: 0 }),
    temporal: t.Boolean(),
    granularity: t.Union([dashboardGranularitySchema, t.Null()]),
    rangeLabel: t.Union([t.String(), t.Null()]),
    dateBasis: t.Union([t.String(), t.Null()]),
    categories: t.Array(t.String(), { maxItems: 60 }),
    // Stable key per category, same order and length as `categories`.
    categoryKeys: t.Array(t.String(), { maxItems: 60 }),
    series: t.Array(resultSeries, { maxItems: 8 }),
    asOf: t.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const DashboardAnalyticsModel = {
  catalog: dashboardCatalogSchema,
  dataBody: t.Object(
    {
      widgets: t.Array(dashboardWidgetSchema, {
        minItems: 1,
        maxItems: maxDashboardWidgets,
      }),
    },
    { additionalProperties: false },
  ),
  data: t.Object(
    {
      asOf: t.String({ format: "date-time" }),
      results: t.Array(result, { maxItems: maxDashboardWidgets }),
    },
    { additionalProperties: false },
  ),
} as const;

export type DashboardDataBody = UnwrapSchema<
  typeof DashboardAnalyticsModel.dataBody
>;
export type DashboardDataResponse = UnwrapSchema<
  typeof DashboardAnalyticsModel.data
>;
export type DashboardWidgetResult = DashboardDataResponse["results"][number];
