import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const id = z.number().int().positive()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const summary = z.object({
  uuid: resourceUuid,
  reference: z.string(),
  referenceInt: z.string(),
  recipeUuid: resourceUuid,
  recipeName: z.string(),
  recipeVersion: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  ingredientCount: z.number().int().nonnegative(),
  channelUuid: resourceUuid.nullable(),
  channelName: z.string().nullable(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  totalPrice: z.string().nullable(),
  businessDate: day.nullable(),
  batchUuid: resourceUuid.nullable(),
  batchReference: z.string().nullable(),
  sourceSheet: z.string().nullable(),
  sourceRow: z.number().int().positive().nullable(),
  sourceChannelText: z.string().nullable(),
  sourceProductText: z.string().nullable(),
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

const receipt = z.object({
  uuid: resourceUuid,
  kind: z.enum(['receipt', 'reversal']),
  amount: z.string(),
  occurredAt: day,
  note: z.string(),
  reversalOfUuid: resourceUuid.nullable(),
  reversed: z.boolean(),
  createdAt: z.string(),
  createdById: z.string().nullable(),
})

const sale = summary.extend({
  unitPrice: z.string().nullable(),
  collectedAmount: z.string().nullable(),
  outstandingAmount: z.string().nullable(),
  ingredients: z.array(ingredient),
  consumptionCount: z.number().int().nonnegative(),
  consumptions: z.array(consumption),
  receipts: z.array(receipt),
})

const channel = z.object({
  uuid: resourceUuid,
  name: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
})

export const SalesPageModel = {
  summary,
  ingredient,
  consumption,
  sale,
  receipt,
  channel,
  list: z.object({
    items: z.array(summary),
    total: z.number().int().nonnegative(),
    limit: id,
    offset: z.number().int().nonnegative(),
  }),
  channelList: z.object({
    items: z.array(channel),
    total: z.number().int().nonnegative(),
    limit: id,
    offset: z.number().int().nonnegative(),
  }),
  input: z.object({
    recipeUuid: resourceUuid,
    channelUuid: resourceUuid,
    quantity: z.number().int().positive(),
    requestKey: z.string().trim().min(1).max(100),
  }),
  receiptInput: z.object({
    amount: z
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
            /^(?!0+(?:\.0+)?$)\d{1,13}(?:\.\d{1,6})?$/,
            'Use a nonzero amount with up to 6 decimals, like 120 or 120,50.'
          )
      ),
    date: day,
    note: z.string().trim().max(500).optional(),
    requestKey: z.string().trim().min(1).max(100),
  }),
}

export type Sale = z.infer<typeof sale>
export type SaleSummary = z.infer<typeof summary>
export type SaleIngredient = z.infer<typeof ingredient>
export type SaleConsumption = z.infer<typeof consumption>
export type SaleReceipt = z.infer<typeof receipt>
export type SaleInput = z.infer<typeof SalesPageModel.input>
export type SaleReceiptInput = z.infer<typeof SalesPageModel.receiptInput>
export type SalesChannel = z.infer<typeof channel>
