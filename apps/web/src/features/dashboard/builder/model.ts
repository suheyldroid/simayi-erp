import { z } from 'zod'
import { t } from '@/lib/i18n'
import { resourceUuid } from '@/lib/resource-uuid'

export const widgetTypeSchema = z.enum([
  'kpi',
  'column',
  'bar',
  'line',
  'donut',
])
export type WidgetType = z.infer<typeof widgetTypeSchema>

/**
 * A dashboard row is four native columns wide. Width is a column count 1-4 and
 * height is any positive whole number of rows; the persisted geometry is only
 * required to be a safe integer, with no per-type or presentation cap.
 */
export const dashboardGridColumns = 4

export const dashboardSourceSchema = z.enum(['sales', 'purchases', 'stock'])
export type DashboardSourceId = z.infer<typeof dashboardSourceSchema>

export const dashboardDateRangeSchema = z.enum([
  'last_30_days',
  'last_90_days',
  'last_6_months',
  'last_12_months',
  'all_time',
])
export type DashboardDateRangeId = z.infer<typeof dashboardDateRangeSchema>

export const dashboardGranularitySchema = z.enum(['day', 'week', 'month'])
export type DashboardGranularity = z.infer<typeof dashboardGranularitySchema>

export const dashboardWidgetSchema = z
  .object({
    id: resourceUuid,
    type: widgetTypeSchema,
    title: z.string().min(1).max(80),
    x: z
      .number()
      .int()
      .min(0)
      .max(dashboardGridColumns - 1),
    y: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    w: z.number().int().min(1).max(dashboardGridColumns),
    h: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    source: dashboardSourceSchema,
    measure: z.string().min(1).max(40),
    groupBy: z.string().min(1).max(40).nullable(),
    seriesBy: z.literal('status').nullable(),
    dateRange: dashboardDateRangeSchema.nullable(),
    filters: z.object({
      statuses: z.array(z.number().int().nonnegative()).max(7),
    }),
  })
  .refine((widget) => widget.x + widget.w <= dashboardGridColumns, {
    message: t('dashboard:validation.fitColumns', {
      columns: dashboardGridColumns,
    }),
    path: ['x'],
  })
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>

export const dashboardDefinitionSchema = z.object({
  version: z.literal(3),
  widgets: z.array(dashboardWidgetSchema).max(24),
})
export type DashboardDefinition = z.infer<typeof dashboardDefinitionSchema>

const catalogMeasureSchema = z.object({
  id: z.string(),
  label: z.string(),
  unitLabel: z.string(),
})

const catalogGroupBySchema = z.object({
  id: z.string(),
  label: z.string(),
  temporal: z.boolean(),
  granularity: dashboardGranularitySchema.nullable(),
  allowedTypes: z.array(widgetTypeSchema),
  allowedRanges: z.array(dashboardDateRangeSchema),
})

const catalogFilterOptionSchema = z.object({
  value: z.number().int().nonnegative(),
  label: z.string(),
})

const catalogSourceSchema = z.object({
  id: dashboardSourceSchema,
  label: z.string(),
  dateBasis: z.string().nullable(),
  dateRanges: z.array(dashboardDateRangeSchema),
  measures: z.array(catalogMeasureSchema),
  groupBys: z.array(catalogGroupBySchema),
  series: z.array(z.object({ id: z.literal('status'), label: z.string() })),
  filters: z.array(
    z.object({
      id: z.literal('statuses'),
      label: z.string(),
      options: z.array(catalogFilterOptionSchema),
    })
  ),
  types: z.array(widgetTypeSchema),
})
export type CatalogSource = z.infer<typeof catalogSourceSchema>
export type CatalogGroupBy = z.infer<typeof catalogGroupBySchema>
export type CatalogMeasure = z.infer<typeof catalogMeasureSchema>

export const dashboardCatalogSchema = z.object({
  scope: z.enum(['global', 'organization']),
  schemaVersion: z.literal(3),
  maxWidgets: z.number().int().positive(),
  widgetTypes: z.array(z.object({ id: widgetTypeSchema, label: z.string() })),
  dateRanges: z.array(
    z.object({ id: dashboardDateRangeSchema, label: z.string() })
  ),
  sources: z.array(catalogSourceSchema),
})
export type DashboardCatalog = z.infer<typeof dashboardCatalogSchema>

export const dashboardLayoutSchema = z.object({
  dashboard: z.object({
    uuid: resourceUuid.nullable(),
    schemaVersion: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
    definition: dashboardDefinitionSchema,
    savedAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
})
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>

const resultSeriesSchema = z.object({
  key: z.string(),
  label: z.string(),
  values: z.array(z.number().int().nonnegative()).max(60),
})

export const dashboardWidgetResultSchema = z.object({
  id: resourceUuid,
  type: widgetTypeSchema,
  measure: z.string(),
  measureLabel: z.string(),
  unitLabel: z.string(),
  total: z.number().int().nonnegative(),
  temporal: z.boolean(),
  granularity: dashboardGranularitySchema.nullable(),
  rangeLabel: z.string().nullable(),
  dateBasis: z.string().nullable(),
  categories: z.array(z.string()).max(60),
  categoryKeys: z.array(z.string()).max(60),
  series: z.array(resultSeriesSchema).max(8),
  asOf: z.string(),
})
export type DashboardWidgetResult = z.infer<typeof dashboardWidgetResultSchema>

export const dashboardDataSchema = z.object({
  asOf: z.string(),
  results: z.array(dashboardWidgetResultSchema).max(24),
})
export type DashboardData = z.infer<typeof dashboardDataSchema>

/**
 * Current builder context. The account and organization identifiers are only
 * cache/draft namespaces; the server derives the layout owner and tenant from
 * the session and never accepts them from the client. The selected branch
 * filters business data only: the saved layout stays per account and company,
 * so switching branch never changes which layout row is read or written.
 */
export type DashboardBuilderScope =
  | {
      kind: 'global'
      accountId: string
      membershipSignature: string
    }
  | {
      kind: 'organization'
      accountId: string
      organizationId: string
      organizationSlug: string
      branchUuid: string | null
      branchName: string | null
    }
