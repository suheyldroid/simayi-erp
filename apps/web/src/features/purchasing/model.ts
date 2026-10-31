import { z } from 'zod'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const metadata = z.record(z.string(), z.unknown()).nullable()
const currency = z.string().regex(/^[A-Z]{3}$/)
const decimal = z.string()
const status = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(25),
  z.literal(30),
  z.literal(40),
  z.literal(50),
  z.literal(60),
])
const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), ...paging })
const order = z.object({
  id,
  reference: z.string(),
  referenceInt: z.string(),
  description: z.string(),
  link: z.string(),
  status,
  supplierId: id.nullable(),
  supplier: z.object({ id, name: z.string(), currency: z.string() }).nullable(),
  supplierReference: z.string(),
  contactId: id.nullable(),
  contact: z.object({ id, name: z.string() }).nullable(),
  addressId: id.nullable(),
  address: z.object({ id, title: z.string() }).nullable(),
  destinationId: id.nullable(),
  destination: z
    .object({ id, name: z.string(), pathstring: z.string() })
    .nullable(),
  projectCodeId: id.nullable(),
  projectCode: z.object({ id, code: z.string() }).nullable(),
  responsibleId: id.nullable(),
  orderCurrency: currency.nullable(),
  totalPrice: decimal.nullable(),
  totalPriceCurrency: currency.nullable(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  creationDate: z.string().nullable(),
  issueDate: z.string().nullable(),
  completeDate: z.string().nullable(),
  createdById: z.string().nullable(),
  receivedById: z.string().nullable(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  metadata,
  version: z.number().int().nonnegative(),
})
const line = z.object({
  id,
  orderId: id,
  partId: id.nullable(),
  part: z
    .object({
      id,
      sku: z.string(),
      partId: id,
      packQuantityNative: z.string().nullable(),
      partName: z.string(),
      trackable: z.boolean(),
    })
    .nullable(),
  quantity: decimal,
  received: decimal,
  discount: decimal,
  purchasePrice: decimal.nullable(),
  purchasePriceCurrency: currency.nullable(),
  line: z.string(),
  lineInt: z.number().int(),
  reference: z.string(),
  notes: z.string(),
  link: z.string(),
  targetDate: z.string().nullable(),
  destinationId: id.nullable(),
  destination: z
    .object({ id, name: z.string(), pathstring: z.string() })
    .nullable(),
  projectCodeId: id.nullable(),
  projectCode: z.object({ id, code: z.string() }).nullable(),
  metadata,
})
const extra = z.object({
  id,
  orderId: id,
  description: z.string(),
  quantity: decimal,
  discount: decimal,
  price: decimal.nullable(),
  priceCurrency: currency.nullable(),
  line: z.string(),
  lineInt: z.number().int(),
  reference: z.string(),
  notes: z.string(),
  link: z.string(),
  targetDate: z.string().nullable(),
  projectCodeId: id.nullable(),
  projectCode: z.object({ id, code: z.string() }).nullable(),
  context: metadata,
  metadata,
})
const amount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,5})?$/)
const money = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,6})?$/)

export const PurchasingModel = {
  order,
  orders: list(order),
  line,
  lines: list(line),
  extra,
  extras: list(extra),
  success: z.object({ success: z.literal(true) }),
  orderInput: z.object({
    supplierId: id,
    reference: z.string().trim().min(1).max(64).optional(),
    description: z.string().max(250).optional(),
    supplierReference: z.string().max(64).optional(),
    contactId: id.optional(),
    addressId: id.optional(),
    destinationId: id.optional(),
    projectCodeId: id.optional(),
    orderCurrency: currency.optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  lineInput: z.object({
    version: z.number().int().nonnegative(),
    partId: id,
    quantity: amount,
    purchasePrice: money.optional(),
    destinationId: id.optional(),
    notes: z.string().max(500).optional(),
  }),
  extraInput: z.object({
    version: z.number().int().nonnegative(),
    description: z.string().max(250).optional(),
    quantity: amount,
    price: money.optional(),
  }),
  receiveInput: z.object({
    version: z.number().int().nonnegative(),
    items: z
      .array(
        z.object({
          lineId: id,
          quantity: amount,
          locationId: id.optional(),
          batch: z.string().max(100).optional(),
          serials: z.string().max(4000).optional(),
          notes: z.string().max(512).optional(),
        })
      )
      .min(1)
      .max(100),
  }),
}
export type PurchaseOrder = z.infer<typeof order>
export type PurchaseLine = z.infer<typeof line>
export type PurchaseExtra = z.infer<typeof extra>
export type OrderInput = z.infer<typeof PurchasingModel.orderInput>
export type LineInput = z.infer<typeof PurchasingModel.lineInput>
export type ExtraInput = z.infer<typeof PurchasingModel.extraInput>
export type ReceiveInput = z.infer<typeof PurchasingModel.receiveInput>
