import { z } from 'zod'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const metadata = z.record(z.string(), z.unknown()).nullable()
const summary = z.object({ id, name: z.string() })
const partSummary = z.object({ id, name: z.string(), ipn: z.string().nullable() })
const formId = z.preprocess((value) => {
  if (typeof value !== 'string' || value.trim() === '') return null
  return Number(value)
}, id.nullable())
const blank = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().nullable()
)
const manufacturerPart = z.object({
  id,
  partId: id,
  part: partSummary,
  manufacturerId: id,
  manufacturer: summary,
  mpn: z.string(),
  description: z.string().nullable(),
  link: z.string().nullable(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  metadata,
})
const supplierPart = z.object({
  id,
  partId: id,
  part: partSummary,
  supplierId: id,
  supplier: summary,
  sku: z.string(),
  active: z.boolean(),
  primary: z.boolean(),
  manufacturerPartId: id.nullable(),
  manufacturerPart: z
    .object({
      id,
      mpn: z.string().nullable(),
      manufacturerId: id.nullable(),
    })
    .nullable(),
  link: z.string().nullable(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  baseCost: z.string(),
  packaging: z.string().nullable(),
  packQuantity: z.string(),
  packQuantityNative: z.string(),
  multiple: z.number().int().positive(),
  available: z.string(),
  availabilityUpdated: z.string().nullable(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  metadata,
  updated: z.string().nullable(),
  priceCount: z.number().int().nonnegative(),
})
const priceBreak = z.object({
  id,
  supplierPartId: id,
  quantity: z.string(),
  price: z.string().nullable(),
  priceCurrency: z.string(),
  updated: z.string().nullable(),
})
const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), ...paging })

export const SupplyModel = {
  manufacturerPart,
  manufacturerParts: list(manufacturerPart),
  supplierPart,
  supplierParts: list(supplierPart),
  priceBreak,
  priceBreaks: list(priceBreak),
  success: z.object({ success: z.literal(true) }),
  manufacturerInput: z.object({
    partId: id,
    manufacturerId: id,
    mpn: z.string().trim().min(1).max(100),
    description: blank.optional(),
    link: blank.optional(),
    barcodeData: z.string().max(500).optional(),
  }),
  supplierInput: z.object({
    partId: id,
    supplierId: id,
    sku: z.string().trim().min(1).max(100),
    active: z.boolean().optional(),
    primary: z.boolean().optional(),
    manufacturerPartId: formId.optional(),
    link: blank.optional(),
    description: blank.optional(),
    note: blank.optional(),
    baseCost: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,3})?$/)
      .optional(),
    packaging: blank.optional(),
    packQuantity: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,10})?$/)
      .optional(),
    multiple: z.number().int().positive().optional(),
    available: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,3})?$/)
      .optional(),
    barcodeData: z.string().max(500).optional(),
  }),
  priceInput: z.object({
    quantity: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,5})?$/),
    price: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,6})?$/)
      .nullable()
      .optional(),
    priceCurrency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
}
export type ManufacturerPart = z.infer<typeof manufacturerPart>
export type SupplierPart = z.infer<typeof supplierPart>
export type PriceBreak = z.infer<typeof priceBreak>
export type ManufacturerInput = z.infer<typeof SupplyModel.manufacturerInput>
export type SupplierInput = z.infer<typeof SupplyModel.supplierInput>
export type PriceInput = z.infer<typeof SupplyModel.priceInput>
