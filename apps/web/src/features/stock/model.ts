import { z } from 'zod'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const metadata = z.record(z.string(), z.unknown()).nullable()
const locationType = z.object({
  id,
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  metadata,
})
const typeSummary = z.object({ id, name: z.string(), icon: z.string() })
const location = z.object({
  id,
  name: z.string(),
  description: z.string(),
  parentId: id.nullable(),
  pathstring: z.string(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  customIcon: z.string().nullable(),
  ownerId: id.nullable(),
  structural: z.boolean(),
  external: z.boolean(),
  locationTypeId: id.nullable(),
  locationType: typeSummary.nullable(),
  childCount: z.number().int().nonnegative(),
  metadata,
})
const optionalId = z.preprocess(
  (value) => (value === '' || value == null ? null : Number(value)),
  id.nullable()
)
const decimal5 = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,5})?$/)
const money = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,6})?$/)
const currency = z.string().regex(/^[A-Z]{3}$/)
const stockStatus = z.union([
  z.literal(10),
  z.literal(50),
  z.literal(55),
  z.literal(60),
  z.literal(65),
  z.literal(70),
  z.literal(75),
  z.literal(85),
])
const stockPart = z.object({
  id,
  name: z.string(),
  ipn: z.string().nullable(),
  trackable: z.boolean(),
  testable: z.boolean(),
})
const stockLocation = z.object({
  id,
  name: z.string(),
  pathstring: z.string(),
})
const stockSupplier = z.object({
  id,
  sku: z.string(),
  supplierId: id,
})
const stockCustomer = z.object({ id, name: z.string() })
const stockItem = z.object({
  id,
  partId: id,
  part: stockPart,
  locationId: id.nullable(),
  location: stockLocation.nullable(),
  supplierPartId: id.nullable(),
  supplierPart: stockSupplier.nullable(),
  customerId: id.nullable(),
  customer: stockCustomer.nullable(),
  ownerId: id.nullable(),
  serial: z.string().nullable(),
  serialInt: z.number().int().nonnegative(),
  batch: z.string().nullable(),
  quantity: z.string(),
  packaging: z.string().nullable(),
  link: z.string(),
  expiryDate: z.string().nullable(),
  stocktakeDate: z.string().nullable(),
  stocktakeUserId: z.string().nullable(),
  creationDate: z.string().nullable(),
  updated: z.string().nullable(),
  deleteOnDeplete: z.boolean(),
  status: stockStatus,
  purchasePrice: z.string().nullable(),
  purchasePriceCurrency: currency.nullable(),
  purchaseOrderId: id.nullable(),
  purchaseOrder: z.object({ id, reference: z.string() }).nullable(),
  isBuilding: z.boolean(),
  buildId: id.nullable(),
  build: z.object({ id, reference: z.string() }).nullable(),
  consumedById: id.nullable(),
  consumedBy: z.object({ id, reference: z.string() }).nullable(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  metadata,
  version: z.number().int().nonnegative(),
})
const trackingEntry = z.object({
  id,
  trackingType: z.number().int().nonnegative(),
  itemId: id.nullable(),
  partId: id.nullable(),
  date: z.string(),
  notes: z.string().nullable(),
  userId: z.string().nullable(),
  deltas: metadata,
})
const testTemplate = z.object({
  id,
  partId: id,
  testName: z.string(),
  key: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  required: z.boolean(),
  requiresValue: z.boolean(),
  requiresAttachment: z.boolean(),
  choices: z.string(),
  editable: z.boolean(),
  metadata,
})
const testResult = z.object({
  id,
  stockItemId: id,
  templateId: id,
  template: z.object({ id, testName: z.string(), key: z.string() }),
  result: z.boolean(),
  value: z.string(),
  attachment: z.string().nullable(),
  notes: z.string(),
  userId: z.string().nullable(),
  testStation: z.string(),
  startedDatetime: z.string().nullable(),
  finishedDatetime: z.string().nullable(),
  date: z.string(),
  current: z.boolean(),
  metadata,
})
const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), ...paging })
export const StockModel = {
  locationType,
  location,
  locationTypes: z.object({ items: z.array(locationType), ...paging }),
  locations: z.object({ items: z.array(location), ...paging }),
  typeBody: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(250),
    icon: z.string().max(100),
    metadata,
  }),
  locationBody: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(250),
    parentId: optionalId,
    barcodeData: z.string().max(500),
    customIcon: z.string().max(100).nullable(),
    ownerId: id.nullable().optional(),
    structural: z.boolean(),
    external: z.boolean(),
    locationTypeId: optionalId,
    metadata,
  }),
  success: z.object({ success: z.literal(true) }),
  stockItem,
  stockItems: list(stockItem),
  createdStock: z.object({ items: z.array(stockItem) }),
  adjustment: z.object({
    deleted: z.boolean(),
    item: stockItem.nullable(),
  }),
  tracking: list(trackingEntry),
  testTemplate,
  testTemplates: list(testTemplate),
  testResult,
  testResults: list(testResult),
  stockInput: z.object({
    partId: id,
    quantity: decimal5.optional(),
    serials: z.string().max(4000).optional(),
    batch: z.string().max(100).nullable().optional(),
    locationId: id.nullable().optional(),
    deleteOnDeplete: z.boolean().optional(),
    status: stockStatus.optional(),
    purchasePrice: money.nullable().optional(),
    purchasePriceCurrency: currency.optional(),
    notes: z.string().max(512).optional(),
  }),
  quantityInput: z.object({
    version: z.number().int().nonnegative(),
    quantity: decimal5,
    notes: z.string().max(512).optional(),
  }),
  countInput: z.object({
    version: z.number().int().nonnegative(),
    quantity: decimal5,
    locationId: id.optional(),
    notes: z.string().max(512).optional(),
  }),
  moveInput: z.object({
    version: z.number().int().nonnegative(),
    locationId: id,
    notes: z.string().max(512).optional(),
  }),
  templateInput: z.object({
    testName: z.string().trim().min(1).max(100),
    description: z.string().max(100).optional(),
    enabled: z.boolean().optional(),
    required: z.boolean().optional(),
    requiresValue: z.boolean().optional(),
    requiresAttachment: z.boolean().optional(),
    choices: z.string().max(5000).optional(),
  }),
  resultInput: z.object({
    templateId: id,
    result: z.boolean(),
    value: z.string().max(500).optional(),
    attachment: z.string().max(100).nullable().optional(),
    notes: z.string().max(500).optional(),
    testStation: z.string().max(500).optional(),
  }),
}
export type LocationType = z.infer<typeof locationType>
export type Location = z.infer<typeof location>
export type LocationTypeInput = z.infer<typeof StockModel.typeBody>
export type LocationInput = z.infer<typeof StockModel.locationBody>
export type StockItem = z.infer<typeof stockItem>
export type StockInput = z.infer<typeof StockModel.stockInput>
export type TestTemplate = z.infer<typeof testTemplate>
export type TemplateInput = z.infer<typeof StockModel.templateInput>
export type TestResult = z.infer<typeof testResult>
export type ResultInput = z.infer<typeof StockModel.resultInput>
