import { z } from 'zod'
import { t } from '@/lib/i18n'
import { resourceUuid } from '@/lib/resource-uuid'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const currency = z.string().regex(/^[A-Z]{3}$/)
const paging = {
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
}

function normalizeAmount(value: string) {
  const normalized = value.trim().replace(/,/g, '.')
  return normalized.startsWith('.') ? `0${normalized}` : normalized
}

// Same exact string contract as the API: at most 13 integer digits and 6
// fraction digits, never a JavaScript number.
const positiveAmount = z
  .string()
  .transform(normalizeAmount)
  .pipe(
    z
      .string()
      .regex(
        /^(?!0+(?:\.0+)?$)\d{1,13}(?:\.\d{1,6})?$/,
        t('operations:common.positiveAmountHint')
      )
  )

const amountBody = {
  date: day,
  note: z.string().trim().max(500).optional(),
  requestKey: z.string().trim().min(1).max(100),
}

const movementKind = z.enum([
  'income',
  'expense',
  'supplier_payment',
  'sale_receipt',
  'purchase',
  'reversal',
])

// Reservation lifecycle: only a purchase row may be on hold or cancelled.
const movementStatus = z.enum(['on_hold', 'posted', 'cancelled'])

const movement = z.object({
  uuid: resourceUuid,
  kind: movementKind,
  status: movementStatus,
  currencyCode: currency,
  amount: z.string(),
  occurredAt: day,
  note: z.string(),
  supplierUuid: resourceUuid.nullable(),
  supplierName: z.string().nullable(),
  // Provenance of the linked document: the original sale branch for a sale
  // receipt/reversal, the order origin branch for a purchase, null for manual
  // entries. Company-wide finance never filters by the selected branch.
  branchUuid: resourceUuid.nullable(),
  branchName: z.string().nullable(),
  purchaseOrderUuid: resourceUuid.nullable(),
  purchaseOrderReference: z.string().nullable(),
  pricingIncomplete: z.boolean(),
  pricingIssueCount: z.number().int().nonnegative(),
  saleUuid: resourceUuid.nullable(),
  saleReference: z.string().nullable(),
  reversalOfUuid: resourceUuid.nullable(),
  reversed: z.boolean(),
  reversible: z.boolean(),
  createdAt: z.string(),
  createdById: z.string().nullable(),
})

const supplierEntryKind = z.enum(['purchase', 'payment', 'reversal'])

const supplierEntry = z.object({
  uuid: resourceUuid,
  kind: supplierEntryKind,
  currencyCode: currency,
  amount: z.string(),
  occurredAt: day,
  note: z.string(),
  branchUuid: resourceUuid.nullable(),
  branchName: z.string().nullable(),
  purchaseOrderUuid: resourceUuid.nullable(),
  purchaseOrderReference: z.string().nullable(),
  moneyMovementUuid: resourceUuid.nullable(),
  reversalOfUuid: resourceUuid.nullable(),
  reversed: z.boolean(),
  createdAt: z.string(),
  createdById: z.string().nullable(),
})

const summary = z.object({
  configured: z.boolean(),
  currencyCode: currency.nullable(),
  balance: z.string(),
  onHold: z.string(),
  availableBalance: z.string(),
  movementCount: z.number().int().nonnegative(),
  pendingPricingCount: z.number().int().nonnegative(),
})

const ledger = z.object({
  configured: z.boolean(),
  currencyCode: currency.nullable(),
  outstanding: z.string(),
  items: z.array(supplierEntry),
  ...paging,
})

export const FinancePageModel = {
  movement,
  supplierEntry,
  summary,
  ledger,
  list: z.object({ items: z.array(movement), ...paging }),
  positiveInput: z.object({ amount: positiveAmount, ...amountBody }),
}

export type MoneyMovement = z.infer<typeof movement>
export type MoneyMovementKind = z.infer<typeof movementKind>
export type MoneyMovementStatus = z.infer<typeof movementStatus>
export type SupplierLedgerEntry = z.infer<typeof supplierEntry>
export type FinanceSummary = z.infer<typeof summary>
export type SupplierLedger = z.infer<typeof ledger>
export type MoneyInput = z.infer<typeof FinancePageModel.positiveInput>

const movementKindKeys: Record<MoneyMovementKind, string> = {
  income: 'kind.income',
  expense: 'kind.expense',
  supplier_payment: 'kind.supplierPayment',
  sale_receipt: 'kind.saleReceipt',
  purchase: 'kind.purchase',
  reversal: 'kind.reversal',
}

const movementStatusKeys: Record<MoneyMovementStatus, string> = {
  on_hold: 'status.onHold',
  posted: 'status.posted',
  cancelled: 'status.cancelled',
}

const supplierEntryKindKeys: Record<SupplierLedgerEntry['kind'], string> = {
  purchase: 'kind.purchase',
  payment: 'kind.payment',
  reversal: 'kind.reversal',
}

export function movementKindLabel(kind: MoneyMovementKind): string {
  return t(`operations:finance.${movementKindKeys[kind]}`)
}

/** Reversed posted entries read as reversed; a lifecycle row keeps its state. */
export function movementStatusLabel(row: {
  kind: MoneyMovementKind
  status: MoneyMovementStatus
  reversed: boolean
}): string {
  if (row.kind === 'reversal') return t('operations:finance.status.reversal')
  if (row.reversed) return t('operations:finance.status.reversed')
  return t(`operations:finance.${movementStatusKeys[row.status]}`)
}

export function supplierEntryKindLabel(
  kind: SupplierLedgerEntry['kind']
): string {
  return t(`operations:finance.${supplierEntryKindKeys[kind]}`)
}
