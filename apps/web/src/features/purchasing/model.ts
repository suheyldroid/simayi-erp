import { z } from 'zod'
import { t } from '@/lib/i18n'
import { resourceUuid } from '@/lib/resource-uuid'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const jsonObject = z.record(z.string(), z.unknown()).nullable()
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
const supplier = z.object({
  uuid: resourceUuid,
  name: z.string(),
  contact: z.string(),
  contactPhone: z.string(),
  contactRole: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string(),
  postalCode: z.string(),
  postalCity: z.string(),
  province: z.string(),
  country: z.string(),
})
const branch = z.object({
  uuid: resourceUuid,
  name: z.string(),
  active: z.boolean(),
})
const order = z.object({
  uuid: resourceUuid,
  reference: z.string(),
  referenceInt: z.string(),
  description: z.string(),
  link: z.string(),
  status,
  statusLabel: z.string(),
  branchUuid: resourceUuid.nullable(),
  branch: branch.nullable(),
  supplierUuid: resourceUuid.nullable(),
  supplier: supplier.nullable(),
  supplierReference: z.string(),
  responsibleUuid: resourceUuid.nullable(),
  totalPrice: decimal.nullable(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  creationDate: z.string().nullable(),
  issueDate: z.string().nullable(),
  completeDate: z.string().nullable(),
  createdById: z.string().nullable(),
  receivedById: z.string().nullable(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  version: z.number().int().nonnegative(),
})
const line = z.object({
  uuid: resourceUuid,
  orderUuid: resourceUuid,
  itemUuid: resourceUuid.nullable(),
  item: z
    .object({
      uuid: resourceUuid,
      name: z.string(),
      ipn: z.string().nullable(),
    })
    .nullable(),
  packQuantityNative: z.string().nullable(),
  unitCode: z.string().nullable(),
  quantity: decimal,
  received: decimal,
  /** Receipt/reversal event count; a reversed receipt still counts. */
  receiptEventCount: z.number().int().nonnegative(),
  discount: decimal,
  purchasePrice: decimal.nullable(),
  currencyCode: z.string().nullable(),
  line: z.string(),
  lineInt: z.number().int(),
  reference: z.string(),
  notes: z.string(),
  link: z.string(),
  targetDate: z.string().nullable(),
})
const extra = z.object({
  uuid: resourceUuid,
  orderUuid: resourceUuid,
  description: z.string(),
  quantity: decimal,
  discount: decimal,
  price: decimal.nullable(),
  currencyCode: z.string().nullable(),
  line: z.string(),
  lineInt: z.number().int(),
  reference: z.string(),
  notes: z.string(),
  link: z.string(),
  targetDate: z.string().nullable(),
  context: jsonObject,
})
const amount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,5})?$/)
const money = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,6})?$/)
/** Replay key for one receipt intent; the backend returns the same events. */
const requestKey = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/)
const receipt = z.object({
  uuid: resourceUuid,
  orderUuid: resourceUuid,
  lineUuid: resourceUuid,
  branchUuid: resourceUuid,
  branch,
  itemUuid: resourceUuid.nullable(),
  quantity: decimal,
  stockQuantity: decimal.nullable(),
  unitCode: z.string().nullable(),
  packQuantityNative: decimal.nullable(),
  purchasePrice: decimal.nullable(),
  /** Gross-price discount percentage snapshot; null only on legacy baselines. */
  discount: decimal.nullable(),
  currencyCode: z.string().nullable(),
  notes: z.string().nullable(),
  userId: z.string().nullable(),
  occurredAt: z.string().nullable(),
  legacyBaseline: z.boolean(),
  reversalOfUuid: resourceUuid.nullable(),
  reversalUuid: resourceUuid.nullable(),
})

export const PurchasingModel = {
  order,
  orders: list(order),
  line,
  lines: list(line),
  extra,
  extras: list(extra),
  success: z.object({ success: z.literal(true) }),
  orderInput: z.object({
    supplierUuid: resourceUuid,
    /** null = company origin; a UUID = originating branch. */
    branchUuid: resourceUuid.nullable().optional(),
    reference: z.string().trim().min(1).max(64).optional(),
    description: z.string().max(250).optional(),
    supplierReference: z.string().max(64).optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  lineInput: z.object({
    version: z.number().int().nonnegative(),
    itemUuid: resourceUuid,
    quantity: amount,
    purchasePrice: money.optional(),
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
    requestKey,
    items: z
      .array(
        z.object({
          lineUuid: resourceUuid,
          branchUuid: resourceUuid,
          quantity: amount,
          notes: z.string().max(512).optional(),
        })
      )
      .min(1),
  }),
  receiveResult: z.object({
    orderVersion: z.number().int().nonnegative(),
    receipts: z.array(receipt),
  }),
  receipt,
  receipts: list(receipt),
  reverseInput: z.object({
    version: z.number().int().nonnegative(),
    notes: z.string().max(512).optional(),
    requestKey: requestKey.optional(),
  }),
  reverseResult: z.object({
    orderVersion: z.number().int().nonnegative(),
    receipt,
  }),
}
/** Display label per stored status value; the value itself is never changed. */
const statusLabels: Readonly<Record<number, string>> = {
  10: 'status.10',
  20: 'status.20',
  25: 'status.25',
  30: 'status.30',
  40: 'status.40',
  50: 'status.50',
  60: 'status.60',
}

export function purchaseOrderStatusLabel(status: number): string {
  const key = statusLabels[status]
  return key === undefined ? String(status) : t(`operations:purchasing.${key}`)
}

export type PurchaseOrder = z.infer<typeof order>
export type PurchaseLine = z.infer<typeof line>
export type PurchaseExtra = z.infer<typeof extra>
export type OrderInput = z.infer<typeof PurchasingModel.orderInput>
export type LineInput = z.infer<typeof PurchasingModel.lineInput>
export type ExtraInput = z.infer<typeof PurchasingModel.extraInput>
export type ReceiveInput = z.infer<typeof PurchasingModel.receiveInput>
export type PurchaseReceipt = z.infer<typeof receipt>
export type ReverseInput = z.infer<typeof PurchasingModel.reverseInput>
