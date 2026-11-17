import { z } from 'zod'
import { t } from '@/lib/i18n'
import { resourceUuid } from '@/lib/resource-uuid'
import { stockQuantity } from '@/features/items/model'
import { UnitsModel } from '@/features/units/model'

const pageSize = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: pageSize,
  offset: z.number().int().nonnegative(),
}
const summary = z.object({
  uuid: resourceUuid,
  name: z.string(),
  pathstring: z.string(),
})
const positiveStock = stockQuantity.refine(
  (value) => /[1-9]/.test(value),
  t('catalog:validation.quantityPositive')
)
/** Branch minimum stock is Decimal(19,6); the transport keeps it exact. */
export const minimumStockQuantity = z
  .string()
  .trim()
  .transform((value) => {
    const normalized = value.replace(/,/g, '.')
    return normalized.startsWith('.') ? `0${normalized}` : normalized
  })
  .pipe(
    z
      .string()
      .regex(/^\d+(?:\.\d{1,6})?$/, t('catalog:validation.minimumDecimals6'))
  )
const notes = z.string().trim().max(512).optional()

/**
 * One item's balance in one branch. A missing BranchStock row reads as the
 * exact zero balance at version 0; it is never an error and never a company
 * wide figure.
 */
const balance = z.object({
  branchUuid: resourceUuid,
  /** Owning branch of this position; identical to `branchUuid`. */
  branch: z.object({
    uuid: resourceUuid,
    name: z.string().min(1),
    active: z.boolean(),
  }),
  itemUuid: resourceUuid,
  name: z.string(),
  ipn: z.string().nullable(),
  active: z.boolean(),
  categoryUuid: resourceUuid.nullable(),
  category: summary.nullable(),
  units: z.string(),
  unitUuid: resourceUuid.nullable(),
  unit: UnitsModel.unit.nullable(),
  stock: z.string(),
  minimumStock: z.string(),
  version: z.number().int().nonnegative(),
  belowMinimum: z.boolean(),
})
const trackingEntry = z.object({
  uuid: resourceUuid,
  itemUuid: resourceUuid.nullable(),
  branchUuid: resourceUuid,
  trackingType: z.number().int().nonnegative(),
  date: z.string(),
  notes: z.string().nullable(),
  userId: z.string().nullable(),
  deltas: z.record(z.string(), z.unknown()).nullable(),
  unitCode: z.string().nullable(),
  quantityBefore: z.string().nullable(),
  quantityAfter: z.string().nullable(),
})

export const StockPageModel = {
  balance,
  balances: z.object({ items: z.array(balance), ...paging }),
  tracking: z.object({ items: z.array(trackingEntry), ...paging }),
  addInput: z.object({ quantity: positiveStock, notes }),
  countInput: z.object({ quantity: stockQuantity, notes }),
  minimumInput: z.object({ minimumStock: minimumStockQuantity }),
}

export type StockBalance = z.infer<typeof balance>
export type StockTrackingEntry = z.infer<typeof trackingEntry>
export type StockOperation = 'add' | 'remove' | 'count'
