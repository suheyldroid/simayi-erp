import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const paging = {
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
}

const currency = z.string().regex(/^[A-Z]{3}$/)

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a business date like 2026-11-14.')
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    'Use a real calendar date.'
  )

function normalizeAmount(value: string) {
  const normalized = value.trim().replace(/,/g, '.')
  return normalized.startsWith('.') ? `0${normalized}` : normalized
}

// Same string contract as the API's Decimal(19,6): zero is allowed, amounts
// are never turned into a JavaScript number.
const amount = z
  .string()
  .transform(normalizeAmount)
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,13}(?:\.\d{1,6})?$/,
        'Use an amount with at most 13 integer and 6 decimal places, like 1250 or 1250,75.'
      )
  )

const device = z.object({
  uuid: resourceUuid,
  name: z.string(),
  bankName: z.string(),
  terminalId: z.string(),
  active: z.boolean(),
  version: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const deviceBody = {
  name: z.string().trim().min(1).max(100),
  bankName: z.string().trim().min(1).max(100),
  terminalId: z.string().trim().min(1).max(100),
  active: z.boolean(),
}

const deviceInput = z.object(deviceBody)

const deviceUpdate = z.object({
  ...deviceBody,
  version: z.number().int().nonnegative(),
})

const reportBatch = z.object({
  uuid: resourceUuid,
  reference: z.string(),
  businessDate: day,
  status: z.number().int(),
})

const report = z.object({
  uuid: resourceUuid,
  reportNumber: z.string(),
  businessDate: day,
  closedAt: z.string(),
  totalAmount: z.string(),
  currencyCode: currency,
  note: z.string(),
  version: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  posDevice: z.object({ uuid: resourceUuid, name: z.string() }),
  salesBatch: reportBatch.nullable(),
})

const reportBody = {
  reportNumber: z.string().trim().min(1).max(100),
  businessDate: day,
  closedAt: z.iso.datetime({ offset: true }),
  totalAmount: amount,
  note: z.string().trim().max(500),
  salesBatchUuid: resourceUuid.nullable(),
}

const reportInput = z.object(reportBody)

const reportUpdate = z.object({
  ...reportBody,
  version: z.number().int().nonnegative(),
})

export const PosDevicesPageModel = {
  device,
  deviceInput,
  deviceUpdate,
  deviceList: z.object({ items: z.array(device), ...paging }),
  report,
  reportInput,
  reportUpdate,
  reportList: z.object({ items: z.array(report), ...paging }),
}

export type PosDevice = z.infer<typeof device>
export type PosDeviceInput = z.infer<typeof deviceInput>
export type PosDeviceUpdate = z.infer<typeof deviceUpdate>
export type ZReport = z.infer<typeof report>
export type ZReportBatch = z.infer<typeof reportBatch>
export type ZReportInput = z.infer<typeof reportInput>
export type ZReportUpdate = z.infer<typeof reportUpdate>
