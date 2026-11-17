import { z } from 'zod'
import { t } from '@/lib/i18n'
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
      .regex(/^\d+(?:\.\d{1,5})?$/, t('catalog:validation.quantityDecimals5'))
      .refine(
        (value) => Number(value) > 0,
        t('catalog:validation.quantityPositive')
      )
  )
const price = z.string().trim().max(20)
const sellingPrice = price
  .refine(
    (value) => /^\d{1,13}(?:\.\d{1,6})?$/.test(value.replace(/,/g, '.')),
    t('catalog:validation.priceDecimals6')
  )
  .transform((value) => value.replace(/,/g, '.'))
const version = z.number().int().nonnegative()

/**
 * Company template, branch-local recipe, or branch customization of a company
 * template. A branch-effective recipe keeps the company root UUID as its
 * selector for both company and customized scopes; local recipes use their own
 * row UUID.
 */
const scope = z.enum(['company', 'local', 'customized'])

const activation = z.object({
  active: z.boolean(),
  version,
})

/**
 * Effective recipe identity shared by the branch catalog and nested recipe
 * ingredients. It carries the company gate (`sourceRecipeActive`) so the UI can
 * explain why a shared recipe cannot be sold or activated.
 */
const effective = z.object({
  uuid: resourceUuid,
  scope,
  name: z.string(),
  /** Exact product code used to match coded workbook rows; text identity. */
  code: z.string().nullable(),
  description: z.string(),
  active: z.boolean(),
  /**
   * Direct-sale flag of the effective definition. Independent of `active` and
   * of branch activation, and required only for a recipe sold on its own:
   * nested ingredient recipes never have to be sellable or priced.
   */
  sellable: z.boolean(),
  sellingPrice: z.string().nullable(),
  priceCurrencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  version,
  sourceRecipeUuid: resourceUuid.nullable(),
  sourceVersion: version.nullable(),
  sourceRecipeActive: z.boolean(),
  ingredientCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const summary = effective.extend({
  /** Branch definition row UUID for local/customized scopes; null for company. */
  customizationUuid: resourceUuid.nullable(),
  /**
   * Owning branch of a branch-local recipe, or null for a company template.
   * The company index lists templates and every branch's locals, so this is
   * the provenance the row link uses.
   */
  branch: z.object({ uuid: resourceUuid, name: z.string() }).nullable(),
  /**
   * Branch activation state and assignment version. Null in company context;
   * version 0 means no assignment row exists yet (implicitly enabled).
   */
  activation: activation.nullable(),
})

const itemIngredientItem = z.object({
  uuid: resourceUuid,
  name: z.string(),
  ipn: z.string().nullable(),
  units: z.string(),
})
const ingredient = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('item'),
    uuid: resourceUuid,
    itemUuid: resourceUuid,
    item: itemIngredientItem,
    quantity: z.string(),
    note: z.string(),
  }),
  z.object({
    kind: z.literal('recipe'),
    uuid: resourceUuid,
    recipeUuid: resourceUuid,
    recipe: effective,
    quantity: z.string(),
    note: z.string(),
  }),
])
const detail = summary.extend({
  ingredients: z.array(ingredient),
})

const ingredientInput = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('item'),
    itemUuid: resourceUuid,
    quantity,
    note: z.string().trim().max(500).optional(),
  }),
  z.strictObject({
    kind: z.literal('recipe'),
    recipeUuid: resourceUuid,
    quantity,
    note: z.string().trim().max(500).optional(),
  }),
])
const fields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(250).optional(),
  active: z.boolean().optional(),
}
/**
 * Exact, case-sensitive product code with leading zeros preserved. Surrounding
 * whitespace is trimmed and an empty value clears the code.
 */
const code = z
  .string()
  .trim()
  .max(100)
  .transform((value) => (value === '' ? null : value))
const ingredients = z.array(ingredientInput).min(1).max(500)

/**
 * Field-level message of the sellable/price rule. A new definition must carry
 * its own price; a patch or customization may omit the price because the write
 * keeps the persisted (or copied company) price, and only an explicit clear is
 * rejected. Zero is a real price.
 */
const sellablePrice = {
  path: ['sellingPrice'],
  message: t('catalog:validation.priceRequiredForSellable'),
}

const createInput = z
  .object({
    ...fields,
    code: code.nullable().optional(),
    sellable: z.boolean().optional(),
    sellingPrice: sellingPrice.nullable().optional(),
    ingredients,
  })
  .refine(
    (value) => value.sellable !== true || value.sellingPrice != null,
    sellablePrice
  )
const updateInput = z
  .object({
    version,
    /**
     * Exact branch customization row expected by the write. Required by the
     * backend for a customized definition so a stale form cannot overwrite a
     * replacement customization with a recycled numeric version.
     */
    customizationUuid: resourceUuid.optional(),
    name: fields.name.optional(),
    code: code.nullable().optional(),
    description: fields.description,
    active: fields.active,
    sellable: z.boolean().optional(),
    sellingPrice: sellingPrice.nullable().optional(),
    ingredients: ingredients.optional(),
  })
  .refine(
    (value) => value.sellable !== true || value.sellingPrice !== null,
    sellablePrice
  )
/** Full branch customization: copy the company template, then apply overrides. */
const customizeInput = z
  .object({
    sourceVersion: version,
    name: fields.name.optional(),
    code: code.nullable().optional(),
    description: fields.description,
    sellable: z.boolean().optional(),
    sellingPrice: sellingPrice.nullable().optional(),
    ingredients: ingredients.optional(),
  })
  .refine(
    (value) => value.sellable !== true || value.sellingPrice !== null,
    sellablePrice
  )
const activationInput = z.object({
  active: z.boolean(),
  version,
})
const resetInput = z.object({ version, customizationUuid: resourceUuid })

export const RecipesModel = {
  scope,
  effective,
  summary,
  ingredient,
  detail,
  ingredientInput,
  createInput,
  updateInput,
  customizeInput,
  activationInput,
  resetInput,
  recipes: z.object({ items: z.array(summary), ...paging }),
  success: z.object({ success: z.literal(true) }),
}

export type RecipeScope = z.infer<typeof scope>
export type RecipeEffective = z.infer<typeof effective>
export type RecipeActivation = z.infer<typeof activation>
export type RecipeSummary = z.infer<typeof summary>
export type RecipeDetail = z.infer<typeof detail>
export type RecipeCreateInput = z.infer<typeof createInput>
export type RecipeUpdateInput = z.infer<typeof updateInput>
export type RecipeCustomizeInput = z.infer<typeof customizeInput>
export type RecipeActivationInput = z.infer<typeof activationInput>
export type RecipeResetInput = z.infer<typeof resetInput>
