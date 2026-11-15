import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const pageSize = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: pageSize,
  offset: z.number().int().nonnegative(),
}
const quantity = z
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
      .refine(
        (value) => Number(value) > 0,
        'Quantity must be greater than zero.'
      )
  )
const ingredientItem = z.object({
  uuid: resourceUuid,
  name: z.string(),
  ipn: z.string().nullable(),
  units: z.string(),
})
const ingredient = z.object({
  uuid: resourceUuid,
  itemUuid: resourceUuid,
  item: ingredientItem,
  quantity: z.string(),
  note: z.string(),
})
const price = z.string().trim().max(20)
const sellingPrice = price
  .refine(
    (value) => /^\d{1,13}(?:\.\d{1,6})?$/.test(value.replace(/,/g, '.')),
    'Use a nonnegative price with up to 6 decimals.'
  )
  .transform((value) => value.replace(/,/g, '.'))

const summary = z.object({
  uuid: resourceUuid,
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  sellingPrice: z.string().nullable(),
  priceCurrencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  version: z.number().int().nonnegative(),
  ingredientCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const detail = summary.extend({
  ingredients: z.array(ingredient),
})
const ingredientInput = z.object({
  itemUuid: resourceUuid,
  quantity,
  note: z.string().trim().max(500).optional(),
})
const fields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(250).optional(),
  active: z.boolean().optional(),
}
const createInput = z.object({
  ...fields,
  sellingPrice: sellingPrice.nullable().optional(),
  ingredients: z.array(ingredientInput).min(1).max(500),
})
const updateInput = z.object({
  version: z.number().int().nonnegative(),
  name: fields.name.optional(),
  description: fields.description,
  active: fields.active,
  sellingPrice: sellingPrice.nullable().optional(),
  ingredients: z.array(ingredientInput).min(1).max(500).optional(),
})

export const RecipesModel = {
  summary,
  ingredient,
  detail,
  ingredientInput,
  createInput,
  updateInput,
  recipes: z.object({ items: z.array(summary), ...paging }),
  success: z.object({ success: z.literal(true) }),
}

export type RecipeSummary = z.infer<typeof summary>
export type RecipeDetail = z.infer<typeof detail>
export type RecipeCreateInput = z.infer<typeof createInput>
export type RecipeUpdateInput = z.infer<typeof updateInput>
