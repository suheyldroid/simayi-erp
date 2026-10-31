import { z } from 'zod'

const code = z.string().regex(/^[A-Z]{3}$/)
const backendName = z.enum(['manual', 'frankfurter'])
const backend = z.object({
  name: backendName,
  version: z.number().int().positive(),
  baseCurrency: code,
  lastUpdate: z.string().datetime(),
})
const rateInput = z.object({
  currency: code,
  value: z
    .string()
    .max(100)
    .regex(/^\d+(?:\.\d{1,6})?$/),
})
const conversionInput = z.object({
  amount: z
    .string()
    .max(100)
    .regex(/^-?\d+(?:\.\d{1,6})?$/),
  from: code,
  to: code,
  backend: backendName,
})
export const CurrencyModel = {
  backendName,
  backend,
  backends: z.array(backend),
  backendInput: z.object({ name: backendName, baseCurrency: code }),
  currencies: z.array(z.object({ code, name: z.string() })),
  rates: z.array(
    rateInput.extend({ id: z.number().int(), backendId: z.string() })
  ),
  snapshot: z.object({ rates: z.array(rateInput).min(1).max(300) }),
  conversionInput,
  conversion: z.object({
    amount: z.string(),
    currency: code,
    backend: z.string(),
    lastUpdate: z.string().datetime(),
  }),
}
export type Backend = z.infer<typeof backend>
export type BackendName = z.infer<typeof backendName>
export type Snapshot = z.infer<typeof CurrencyModel.snapshot>
export type ConversionInput = z.infer<typeof conversionInput>
