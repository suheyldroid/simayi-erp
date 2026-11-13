import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'
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
const formUuid = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  resourceUuid.nullable()
)
const quantity = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,6})?$/)
export const stockQuantity = z
  .string()
  .trim()
  .transform((value) => {
    const normalized = value.replace(/,/g, '.')
    return normalized.startsWith('.') ? `0${normalized}` : normalized
  })
  .pipe(
    z
      .string()
      .regex(
        /^\d+(?:\.\d{1,5})?$/,
        'Use a number with up to 5 decimals, like 0.25 or 0,25.'
      )
  )

/** Canonical comparison form of a validated stock decimal string. */
export function canonicalStock(value: string): string {
  return value
    .replace(/^0+(?=\d)/, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}
const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().max(maxLength).nullable()
  )
const item = z.object({
  uuid: resourceUuid,
  name: z.string(),
  description: z.string(),
  categoryUuid: resourceUuid.nullable(),
  units: z.string(),
  unitUuid: resourceUuid.nullable(),
  unit: UnitsModel.unit.nullable(),
  image: z.string().nullable(),
  ipn: z.string().nullable(),
  defaultExpiry: z.number().int().nonnegative(),
  minimumStock: z.string(),
  stock: z.string(),
  active: z.boolean(),
  creationDate: z.string().nullable(),
  creationUserId: z.string().nullable(),
  version: z.number().int().nonnegative(),
  category: summary.nullable(),
})
const list = <T extends z.ZodType>(entry: T) =>
  z.object({ items: z.array(entry), ...paging })

export const ItemsModel = {
  item,
  items: list(item),
  success: z.object({ success: z.literal(true) }),
  itemInput: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(250).optional(),
    image: optionalText(100).optional(),
    categoryUuid: formUuid.optional(),
    unitUuid: resourceUuid.optional(),
    ipn: optionalText(100).optional(),
    defaultExpiry: z.number().int().nonnegative().optional(),
    minimumStock: quantity.optional(),
    stock: stockQuantity.optional(),
    active: z.boolean().optional(),
    version: z.number().int().nonnegative().optional(),
  }),
}
export type Item = z.infer<typeof item>
export type ItemInput = z.infer<typeof ItemsModel.itemInput>
