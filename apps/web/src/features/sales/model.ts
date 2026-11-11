import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const id = z.number().int().positive()

const summary = z.object({
  uuid: resourceUuid,
  reference: z.string(),
  referenceInt: z.string(),
  recipeUuid: resourceUuid,
  recipeName: z.string(),
  recipeVersion: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  ingredientCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  createdById: z.string().nullable(),
  createdByName: z.string(),
})

const ingredient = z.object({
  uuid: resourceUuid,
  recipeLineUuid: resourceUuid,
  itemUuid: resourceUuid,
  itemName: z.string(),
  itemIpn: z.string().nullable(),
  itemUnits: z.string(),
  quantityPerRecipe: z.string(),
  requiredQuantity: z.string(),
  consumedQuantity: z.string(),
  note: z.string(),
})

const consumption = z.object({
  uuid: resourceUuid,
  buildComponentUuid: resourceUuid,
  itemUuidRef: resourceUuid,
  itemUuid: resourceUuid.nullable(),
  quantity: z.string(),
  quantityBefore: z.string(),
  quantityAfter: z.string(),
  createdAt: z.string(),
  createdById: z.string().nullable(),
  createdByName: z.string(),
})

const sale = summary.extend({
  ingredients: z.array(ingredient),
  consumptionCount: z.number().int().nonnegative(),
  consumptions: z.array(consumption),
})

export const SalesPageModel = {
  summary,
  ingredient,
  consumption,
  sale,
  list: z.object({
    items: z.array(summary),
    total: z.number().int().nonnegative(),
    limit: id,
    offset: z.number().int().nonnegative(),
  }),
  input: z.object({
    recipeUuid: resourceUuid,
    quantity: z.number().int().positive(),
    requestKey: z.string().trim().min(1).max(100),
  }),
}

export type Sale = z.infer<typeof sale>
export type SaleSummary = z.infer<typeof summary>
export type SaleIngredient = z.infer<typeof ingredient>
export type SaleConsumption = z.infer<typeof consumption>
export type SaleInput = z.infer<typeof SalesPageModel.input>
