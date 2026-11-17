import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const count = z.number().int().nonnegative()
const month = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/)
// Exact decimal strings at the API boundary; never converted to numbers.
const stockText = z
  .string()
  .regex(/^\d+(?:\.\d{1,5})?$/)
  .max(21)
const minimumStockText = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/)
  .max(20)

/**
 * One UTC month of new records. `month` is `YYYY-MM` and each value counts
 * records created inside that month, never a running total.
 */
const dashboardMonthSchema = z.object({
  month,
  users: count,
  organizations: count,
  sales: count,
  purchases: count,
})

/** Critical branch stock position: one active item in one active branch. */
const criticalStockItemSchema = z.object({
  uuid: resourceUuid,
  name: z.string(),
  ipn: z.string().nullable(),
  stock: stockText,
  minimumStock: minimumStockText,
  units: z.string().nullable(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  branchUuid: resourceUuid,
  branchName: z.string(),
})

/**
 * Aggregate-only platform overview. The endpoint never returns business
 * records or personal metadata, only counts.
 */
export const systemDashboardSchema = z.object({
  totals: z.object({
    users: count,
    organizations: count,
    sales: count,
    purchases: count,
  }),
  months: z.array(dashboardMonthSchema).length(6),
})

/**
 * Current account summary. Totals cover every organization the account is a
 * native member of; `alerts.total` is the full alarm count while `items` is the
 * bounded, deterministic slice the endpoint returns.
 */
export const personalDashboardSchema = z.object({
  totals: z.object({
    sales: count,
    purchases: count,
  }),
  alerts: z.object({
    total: count,
    items: z.array(criticalStockItemSchema).max(8),
  }),
})
