import { z } from 'zod'

const currencyCode = z.string().regex(/^[A-Z]{3}$/)

export const currency = z.object({
  code: currencyCode,
  name: z.string(),
  fractionDigits: z.number().int().min(0).max(4),
})

export const CurrencyModel = {
  currency,
  catalog: z.object({ items: z.array(currency) }),
  preference: z.object({ defaultCurrencyCode: currencyCode.nullable() }),
  preferenceInput: z.object({ defaultCurrencyCode: currencyCode.nullable() }),
}
