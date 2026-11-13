import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const id = z.number().int().positive()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const column = z.string().regex(/^[A-Z]{1,3}$/)

const issue = z.object({
  code: z.string(),
  message: z.string(),
  blocking: z.boolean(),
})

const channel = z.object({
  uuid: resourceUuid,
  name: z.string(),
})

const summary = z.object({
  uuid: resourceUuid,
  reference: z.string(),
  referenceInt: z.string(),
  businessDate: day,
  status: z.number().int(),
  sourceFileName: z.string(),
  sourceFileSize: z.number().int().nonnegative(),
  rowCount: z.number().int().nonnegative(),
  quantityTotal: z.number().int().nonnegative(),
  channelCount: z.number().int().nonnegative(),
  processedAt: z.string().nullable(),
  createdAt: z.string(),
  createdById: z.string().nullable(),
  createdByName: z.string(),
  channels: z.array(channel),
})

const sale = z.object({
  uuid: resourceUuid,
  reference: z.string(),
  recipeName: z.string(),
  quantity: z.number().int().positive(),
  sourceRow: z.number().int().positive().nullable(),
  channel: channel.nullable(),
})

const detail = summary.extend({
  sheetNames: z.array(z.string()),
  sheetName: z.string().nullable(),
  headerRow: z.number().int().positive().nullable(),
  channelColumn: column.nullable(),
  productColumn: column.nullable(),
  quantityColumn: column.nullable(),
  productCodeColumn: column.nullable(),
  excludedRows: z.array(z.number().int().positive()),
  sales: z.array(sale),
})

const previewRow = z.object({
  row: z.number().int().positive(),
  excluded: z.boolean(),
  included: z.boolean(),
  cells: z.array(z.string()),
  channelValue: z.string(),
  productValue: z.string(),
  productCode: z.string(),
  productKey: z.string().nullable(),
  quantityRaw: z.string(),
  quantity: z.number().int().positive().nullable(),
  channelUuid: resourceUuid.nullable(),
  channelName: z.string().nullable(),
  recipeUuid: resourceUuid.nullable(),
  recipeName: z.string().nullable(),
  issues: z.array(issue),
})

const previewChannel = z.object({
  sourceValue: z.string(),
  channelUuid: resourceUuid.nullable(),
  channelName: z.string().nullable(),
  rows: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
})

const previewProduct = z.object({
  productKey: z.string(),
  label: z.string(),
  sourceCode: z.string().nullable(),
  sourceText: z.string().nullable(),
  recipeUuid: resourceUuid.nullable(),
  recipeName: z.string().nullable(),
  rows: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative(),
})

const requirement = z.object({
  itemUuid: resourceUuid,
  itemName: z.string(),
  itemUnits: z.string(),
  required: z.string(),
  available: z.string(),
  missing: z.string(),
})

const previewGridRow = z.object({
  row: z.number().int().positive(),
  cells: z.array(z.string()),
})

const preview = z.object({
  configured: z.boolean(),
  sheetNames: z.array(z.string()),
  sheetName: z.string().nullable(),
  headerRow: z.number().int().positive().nullable(),
  channelColumn: column.nullable(),
  productColumn: column.nullable(),
  quantityColumn: column.nullable(),
  productCodeColumn: column.nullable(),
  excludedRows: z.array(z.number().int().positive()),
  grid: z.array(previewGridRow),
  gridTruncated: z.boolean(),
  rows: z.array(previewRow),
  rowsTruncated: z.boolean(),
  cellsTruncated: z.boolean(),
  emptyRowCount: z.number().int().nonnegative(),
  channels: z.array(previewChannel),
  products: z.array(previewProduct),
  requirements: z.array(requirement),
  includedRows: z.number().int().nonnegative(),
  excludedRowsCount: z.number().int().nonnegative(),
  saleQuantity: z.number().int().nonnegative(),
  blockingIssueCount: z.number().int().nonnegative(),
})

export type BatchSummary = z.infer<typeof summary>
export type BatchDetail = z.infer<typeof detail>
export type BatchPreview = z.infer<typeof preview>
export type BatchPreviewRow = z.infer<typeof previewRow>
export type BatchPreviewProduct = z.infer<typeof previewProduct>
export type BatchRequirement = z.infer<typeof requirement>

export type BatchPatch = {
  businessDate?: string
  sheet?: {
    sheetName: string
    headerRow: number
    channelColumn: string
    productColumn: string
    quantityColumn: string
    productCodeColumn?: string | null
  }
  excludedRows?: number[]
  channelMappings?: { sourceValue: string; channelUuid: string | null }[]
  productMappings?: { productKey: string; recipeUuid: string | null }[]
}

export const SalesBatchesPageModel = {
  issue,
  summary,
  detail,
  previewRow,
  preview,
  list: z.object({
    items: z.array(summary),
    total: z.number().int().nonnegative(),
    limit: id,
    offset: z.number().int().nonnegative(),
  }),
}
