import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'
import { stockQuantity } from '@/features/items/model'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const positiveStock = stockQuantity.refine(
  (value) => /[1-9]/.test(value),
  'Quantity must be greater than zero.'
)
const trackingEntry = z.object({
  uuid: resourceUuid,
  itemUuid: resourceUuid.nullable(),
  trackingType: z.number().int().nonnegative(),
  date: z.string(),
  notes: z.string().nullable(),
  userId: z.string().nullable(),
  deltas: z.record(z.string(), z.unknown()).nullable(),
  quantityBefore: z.string().nullable(),
  quantityAfter: z.string().nullable(),
})
const notes = z.string().trim().max(512).optional()

export const StockPageModel = {
  tracking: z.object({ items: z.array(trackingEntry), ...paging }),
  addInput: z.object({ quantity: positiveStock, notes }),
  countInput: z.object({ quantity: stockQuantity, notes }),
}

export type StockTrackingEntry = z.infer<typeof trackingEntry>
export type StockOperation = 'add' | 'remove' | 'count'
