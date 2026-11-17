import { t } from '@/lib/i18n'

type ServerTemplate = {
  pattern: RegExp
  key: string
  /** Interpolation argument for each capture group, in order. */
  args: readonly string[]
}

/**
 * Anchored English templates the API builds from data. Captures are inserted
 * verbatim: names, UUIDs, worksheet names, currency codes and decimal amounts
 * are never parsed, reformatted or rounded. Longer templates that share a
 * prefix come first so a generic pattern cannot swallow a specific message.
 */
const templates: readonly ServerTemplate[] = [
  {
    pattern:
      /^([\s\S]+) cannot be used as an ingredient: activate it for this branch first$/,
    key: 'ingredientRecipeActivateForBranch',
    args: ['name'],
  },
  {
    pattern:
      /^([\s\S]+) cannot be used as an ingredient: it must be an active item$/,
    key: 'ingredientItemInactive',
    args: ['name'],
  },
  {
    pattern:
      /^([\s\S]+) cannot be used as an ingredient: it must be an active recipe$/,
    key: 'ingredientRecipeActiveRequired',
    args: ['name'],
  },
  {
    pattern:
      /^([\s\S]+) has no unit; assign a unit before using it as an ingredient$/,
    key: 'ingredientItemNoUnit',
    args: ['name'],
  },
  {
    pattern: /^Ingredient item ([\s\S]+) appears more than once in the recipe$/,
    key: 'ingredientItemDuplicate',
    args: ['uuid'],
  },
  {
    pattern:
      /^Ingredient recipe ([\s\S]+) appears more than once in the recipe$/,
    key: 'ingredientRecipeDuplicate',
    args: ['uuid'],
  },
  {
    pattern:
      /^Recipe ([\s\S]+) cannot be sold: its ingredient chain contains a cycle$/,
    key: 'recipeCycle',
    args: ['name'],
  },
  {
    pattern:
      /^An ingredient amount of recipe ([\s\S]+) must be greater than zero$/,
    key: 'ingredientAmountPositive',
    args: ['name'],
  },
  {
    pattern: /^Ingredient ([\s\S]+) must be an active item$/,
    key: 'itemInactive',
    args: ['name'],
  },
  {
    pattern:
      /^Ingredient ([\s\S]+) has no unit; assign a unit before selling this recipe$/,
    key: 'itemNoUnit',
    args: ['name'],
  },
  {
    pattern: /^Recipe ([\s\S]+) has an ingredient without an item or recipe$/,
    key: 'recipeLineWithoutTarget',
    args: ['name'],
  },
  {
    pattern: /^An ingredient recipe of ([\s\S]+) was not found in this scope$/,
    key: 'ingredientRecipeOfNotFound',
    args: ['name'],
  },
  {
    pattern:
      /^Ingredient recipe ([\s\S]+) must be active for the selected branch$/,
    key: 'ingredientRecipeBranchActive',
    args: ['name'],
  },
  {
    pattern: /^Ingredient recipe ([\s\S]+) does not have any ingredients$/,
    key: 'ingredientRecipeNoIngredients',
    args: ['name'],
  },
  {
    pattern:
      /^Effective quantity for ([\s\S]+) needs more than 5 decimal places per sold unit; adjust the nested ingredient amounts$/,
    key: 'effectiveQuantityScale',
    args: ['name'],
  },
  {
    pattern:
      /^Effective quantity for ([\s\S]+) per sold unit exceeds the supported precision$/,
    key: 'effectiveQuantityPrecision',
    args: ['name'],
  },
  {
    pattern:
      /^Required quantity for ([\s\S]+) exceeds the supported precision$/,
    key: 'requiredQuantityPrecision',
    args: ['name'],
  },
  {
    pattern:
      /^Required quantity for ([\s\S]+) needs more than 5 decimal places$/,
    key: 'requiredQuantityScale',
    args: ['name'],
  },
  {
    pattern:
      /^Recipe ([\s\S]+) has no selling price; set a price before selling it$/,
    key: 'recipeNoSellingPrice',
    args: ['name'],
  },
  {
    pattern:
      /^Recipe ([\s\S]+) is priced in ([A-Z]{3}), but this organization records money in ([A-Z]{3})$/,
    key: 'recipePriceCurrencyOrg',
    args: ['name', 'recipeCurrency', 'financeCurrency'],
  },
  {
    pattern:
      /^This organization records money in ([A-Z]{3}), but the fixed system currency is ([A-Z]{3}); new monetary entries cannot mix currencies\. Reconcile the recorded finance history before recording new money\.$/,
    key: 'financeCurrencyFixedConflict',
    args: ['recorded', 'fixed'],
  },
  {
    pattern:
      /^This sale is recorded in ([A-Z]{3}), but this organization records money in ([A-Z]{3})$/,
    key: 'saleCurrencyMismatch',
    args: ['saleCurrency', 'financeCurrency'],
  },
  {
    pattern: /^The receipt exceeds the outstanding amount of ([\s\S]+)$/,
    key: 'receiptExceedsOutstanding',
    args: ['amount'],
  },
  {
    pattern:
      /^This purchase order is in ([A-Z]{3}), but this organization records money in ([A-Z]{3})$/,
    key: 'purchaseCurrencyMismatch',
    args: ['orderCurrency', 'financeCurrency'],
  },
  {
    pattern: /^Channel ([\s\S]+) is not mapped$/,
    key: 'channelUnmapped',
    args: ['channel'],
  },
  {
    pattern: /^Channel ([\s\S]+) is inactive$/,
    key: 'channelInactive',
    args: ['channel'],
  },
  {
    pattern: /^Product ([\s\S]+) is not mapped to a recipe$/,
    key: 'productUnmapped',
    args: ['product'],
  },
  {
    pattern: /^Recipe ([\s\S]+) has no selling price$/,
    key: 'recipeUnpriced',
    args: ['recipe'],
  },
  {
    pattern:
      /^Recipe ([\s\S]+) is priced in ([A-Z]{3}), but this batch records money in ([A-Z]{3})$/,
    key: 'recipePriceCurrencyBatch',
    args: ['recipe', 'priceCurrency', 'currency'],
  },
  {
    pattern:
      /^The system currency ([A-Z]{3}) is not an active ISO 4217 code; no sales can be recorded in it$/,
    key: 'financeCurrencyInactive',
    args: ['currency'],
  },
  {
    pattern:
      /^This organization records money in ([A-Z]{3}), but the fixed system currency is ([A-Z]{3}); new sales cannot mix currencies$/,
    key: 'financeCurrencyConflict',
    args: ['financeCurrency', 'currency'],
  },
  {
    pattern: /^Quantity ([\s\S]+) is not a whole number$/,
    key: 'quantityNotInteger',
    args: ['quantity'],
  },
  {
    pattern: /^Worksheet ([\s\S]+) is not part of this workbook$/,
    key: 'worksheetNotPartOfWorkbook',
    args: ['sheet'],
  },
  {
    pattern: /^Excluded row (\d+) is outside the data rows$/,
    key: 'excludedRowOutsideDataRows',
    args: ['row'],
  },
  {
    pattern: /^Channel value ([\s\S]+) is not present in this worksheet$/,
    key: 'channelValueNotPresent',
    args: ['value'],
  },
  {
    pattern: /^Sales channel for ([\s\S]+) must be an active channel$/,
    key: 'channelNotActive',
    args: ['value'],
  },
  {
    pattern: /^Product ([\s\S]+) is not present in this worksheet$/,
    key: 'productNotPresent',
    args: ['product'],
  },
  {
    pattern: /^Recipe for ([\s\S]+) must be an active recipe of this branch$/,
    key: 'productRecipeNotActive',
    args: ['product'],
  },
  {
    pattern:
      /^Worksheet ([\s\S]+) has (\d+) rows; at most (\d+) rows are supported$/,
    key: 'worksheetRowLimit',
    args: ['sheet', 'rows', 'maximum'],
  },
  {
    pattern:
      /^Worksheet ([\s\S]+) has (\d+) columns; at most (\d+) columns are supported$/,
    key: 'worksheetColumnLimit',
    args: ['sheet', 'columns', 'maximum'],
  },
  {
    pattern: /^Worksheet ([\s\S]+) could not be read$/,
    key: 'worksheetUnreadable',
    args: ['sheet'],
  },
  {
    pattern:
      /^The system currency ([A-Z]{3}) is not an active ISO 4217 code, so no new amounts can be recorded in it; a database operator must reconcile the stored system currency$/,
    key: 'systemCurrencyInactive',
    args: ['currency'],
  },
  {
    pattern:
      /^The system currency is already configured as ([A-Z]{3}) and cannot change$/,
    key: 'systemCurrencyFixed',
    args: ['currency'],
  },
]

/**
 * Turkish text for a known dynamic server template, or `null` when the message
 * is not one of them. Only call this for server error text: exact anchored
 * templates keep user-entered data opaque and line-break safe.
 */
export function translateServerTemplate(message: string): string | null {
  for (const { pattern, key, args } of templates) {
    const match = pattern.exec(message)
    if (!match) continue
    const values: Record<string, string> = {}
    for (const [index, arg] of args.entries())
      values[arg] = match[index + 1] ?? ''
    return t(`common:serverTemplates.${key}`, values)
  }
  return null
}
