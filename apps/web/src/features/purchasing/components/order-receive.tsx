import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { isPositiveDecimal, subtractDecimalStrings } from '@/lib/decimal-string'
import { t } from '@/lib/i18n'
import { invalidateBranchStockCaches } from '@/lib/item-stock-cache'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { errorMessage, purchasingApi } from '../api'
import {
  PurchasingModel,
  type PurchaseLine,
  type PurchaseOrder,
  type ReceiveInput,
} from '../model'

/** Stock quantities are Decimal(20,5): five digits after the point. */
const QUANTITY_SCALE = 5
const QUANTITY_TICKS = 10 ** QUANTITY_SCALE

/**
 * Exact decimal string to integer ticks at the quantity scale. The transport
 * caps quantities well below Number.MAX_SAFE_INTEGER, so the slider stays
 * integer-only and never sees a rounded float.
 */
function quantityTicks(value: string): number | null {
  const match = /^(\d{1,10})(?:\.(\d{0,5}))?$/.exec(value.trim())
  if (match === null) return null
  return (
    Number(match[1]) * QUANTITY_TICKS +
    Number((match[2] ?? '').padEnd(QUANTITY_SCALE, '0'))
  )
}

/** Integer ticks back to a canonical decimal string without trailing zeros. */
function canonicalQuantity(ticks: number): string {
  const whole = String(Math.trunc(ticks / QUANTITY_TICKS))
  const fraction = String(ticks % QUANTITY_TICKS)
    .padStart(QUANTITY_SCALE, '0')
    .replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}

/**
 * One slider step is the finest unit the outstanding quantity itself uses, so
 * the slider only lands on values that unit can express: a whole outstanding
 * steps by 1, a 2.5 outstanding steps by 0.1. The exact input beside it still
 * accepts any supported five-decimal amount.
 */
function quantityStepTicks(outstanding: string): number {
  const fraction = outstanding.split('.')[1] ?? ''
  return QUANTITY_TICKS / 10 ** fraction.length
}

type ReceiveRow = {
  uuid: string
  name: string
  ipn: string | null
  unitCode: string | null
  quantity: string
  received: string
  amount: string
  selected: boolean
  branchUuid: string | null
}

/**
 * Frozen copy of one sheet opening. The order uuid, version, amounts and
 * replay key are captured here so a background refresh cannot rebase old
 * amounts onto a newer version, and a retried submission of the same intent
 * reuses its key instead of creating a second receipt.
 */
type ReceiveDraft = {
  orderUuid: string
  version: number
  rows: ReceiveRow[]
  requestKey: string | null
  signature: string | null
}

/**
 * A branch-origin order defaults each line to its source branch. A company
 * origin has no implied destination, so every line starts unassigned and the
 * user must choose one.
 */
function receiveDraft(
  order: PurchaseOrder,
  lines: PurchaseLine[],
  activeBranchIds: ReadonlySet<string>
): ReceiveDraft {
  return {
    orderUuid: order.uuid,
    version: order.version,
    requestKey: null,
    signature: null,
    rows: lines.flatMap((line) => {
      const outstanding = subtractDecimalStrings(line.quantity, line.received)
      if (line.item === null || !isPositiveDecimal(outstanding)) return []
      return [
        {
          uuid: line.uuid,
          name: line.item.name,
          ipn: line.item.ipn,
          unitCode: line.unitCode,
          quantity: line.quantity,
          received: line.received,
          amount: outstanding,
          selected: true,
          branchUuid:
            order.branchUuid !== null && activeBranchIds.has(order.branchUuid)
              ? order.branchUuid
              : null,
        },
      ]
    }),
  }
}

function ReceiveLineField({
  row,
  branches,
  onChange,
}: {
  row: ReceiveRow
  branches: { uuid: string; name: string }[]
  onChange: (patch: Partial<ReceiveRow>) => void
}) {
  const selectId = useId()
  const outstanding = subtractDecimalStrings(row.quantity, row.received)
  const outstandingTicks = quantityTicks(outstanding) ?? 0
  const ticks = quantityTicks(row.amount)
  // A finer typed amount refines the step too, so the native range never
  // sanitizes the current value away from the exact amount beside it.
  const stepTicks =
    ticks === null
      ? quantityStepTicks(outstanding)
      : Math.min(quantityStepTicks(outstanding), quantityStepTicks(row.amount))
  const unit = row.unitCode ?? t('operations:common.unknownUnit')
  const inputId = `receive-line-${row.uuid}`
  const branchValue = branches.some((branch) => branch.uuid === row.branchUuid)
    ? (row.branchUuid as string)
    : undefined
  return (
    <div className='space-y-2 rounded-md border border-border p-3'>
      <div className='flex items-start gap-3'>
        <Checkbox
          id={inputId}
          checked={row.selected}
          onCheckedChange={(value) => onChange({ selected: value === true })}
        />
        <div className='space-y-1'>
          <Label htmlFor={inputId} className='font-normal'>
            {row.name}
            {row.ipn ? ` · ${row.ipn}` : ''}
          </Label>
          <p className='text-xs text-muted-foreground'>
            {t('operations:purchasing.receive.lineSummary', {
              ordered: row.quantity,
              received: row.received,
              outstanding,
              unit,
            })}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-3'>
        <input
          type='range'
          min={0}
          max={outstandingTicks}
          step={stepTicks}
          value={ticks ?? 0}
          disabled={!row.selected}
          aria-label={t('operations:purchasing.receive.amountSliderLabel', {
            item: row.name,
          })}
          aria-valuetext={`${row.amount} ${unit}`}
          onChange={(event) =>
            onChange({ amount: canonicalQuantity(Number(event.target.value)) })
          }
          className='h-6 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50'
        />
        <Input
          inputMode='decimal'
          value={row.amount}
          disabled={!row.selected}
          aria-label={t('operations:purchasing.receive.amountInputLabel', {
            item: row.name,
            unit,
          })}
          onChange={(event) => {
            // A leading point is completed so a partially typed amount is
            // already a parseable decimal.
            const next = event.target.value.startsWith('.')
              ? `0${event.target.value}`
              : event.target.value
            const nextTicks = quantityTicks(next)
            // A typed amount above the outstanding quantity is held at the
            // maximum instead of being sent and rejected as an over-receive.
            onChange({
              amount:
                nextTicks !== null && nextTicks > outstandingTicks
                  ? outstanding
                  : next,
            })
          }}
          onBlur={(event) => {
            // Writing the canonical form keeps a trailing point or trailing
            // zeros from failing the exact decimal contract on submit.
            const blurTicks = quantityTicks(event.target.value)
            if (blurTicks !== null)
              onChange({ amount: canonicalQuantity(blurTicks) })
          }}
          className='w-28 text-right tabular-nums'
        />
        <span className='w-16 text-sm text-muted-foreground'>{unit}</span>
      </div>
      <div className='flex items-center gap-2'>
        <Label htmlFor={selectId} className='text-sm font-normal'>
          {t('operations:purchasing.receive.destination')}
        </Label>
        <Select
          value={branchValue}
          disabled={!row.selected}
          onValueChange={(value) => onChange({ branchUuid: value })}
        >
          <SelectTrigger id={selectId} className='w-56'>
            <SelectValue
              placeholder={t('operations:purchasing.receive.chooseDestination')}
            />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.uuid} value={branch.uuid}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function OrderReceive({
  order,
  lines,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
}) {
  const client = useQueryClient()
  const selectedBranch = useOptionalBranch()
  const bulkBranchId = useId()
  const scope = organizationCacheScope()
  const [draft, setDraft] = useState<ReceiveDraft | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const branches = useQuery({
    queryKey: ['purchasing', scope, 'destination-branches'],
    queryFn: () => purchasingApi.receiptBranches(),
    refetchOnWindowFocus: false,
  })
  const activeBranches = (branches.data ?? []).filter((branch) => branch.active)
  const activeBranchIds = new Set(activeBranches.map((branch) => branch.uuid))
  const save = useMutation({
    mutationFn: (input: {
      orderUuid: string
      body: ReceiveInput
      branches: CapturedBranchScope[]
      scope: string
      ui: CapturedBranchScope
    }) => purchasingApi.receive(input.orderUuid, input.body),
    onSuccess: async (result, input) => {
      // The order/receipt views and every captured destination branch are
      // refreshed even if the sheet was remounted, but the replaced UI is only
      // closed and announced while it is still the selected branch.
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      await Promise.all(
        input.branches.map((captured) =>
          invalidateBranchStockCaches(client, captured)
        )
      )
      if (!isBranchScopeCurrent(input.ui)) return
      setDraft(null)
      toast.success(
        result.receipts.length === 1
          ? t('operations:purchasing.receive.recorded')
          : t('operations:purchasing.receive.recordedMany', {
              count: result.receipts.length,
            })
      )
    },
    onError: async (caught, input) => {
      // The open draft stays frozen with its captured version, amounts and
      // replay key; the refresh only makes a later reopen read current lines.
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  const receivable = receiveDraft(order, lines, activeBranchIds)
  const updateRow = (uuid: string, patch: Partial<ReceiveRow>) => {
    setDraft((current) =>
      current === null
        ? null
        : {
            ...current,
            rows: current.rows.map((row) =>
              row.uuid === uuid ? { ...row, ...patch } : row
            ),
          }
    )
  }
  const selectedCount = (draft?.rows ?? []).filter(
    (row) => row.selected && (quantityTicks(row.amount) ?? 0) > 0
  ).length
  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>
          {t('operations:purchasing.receive.title')}
        </h2>
        {receivable.rows.length > 0 && (
          <Button
            type='button'
            variant='outline'
            disabled={branches.isPending || activeBranches.length === 0}
            onClick={() => {
              setValidationError(null)
              save.reset()
              setDraft(receivable)
            }}
          >
            {t('operations:purchasing.receive.open')}
          </Button>
        )}
      </div>
      <p className='text-sm text-muted-foreground'>
        {receivable.rows.length === 0
          ? t('operations:purchasing.receive.nothing')
          : order.branchUuid
            ? t('operations:purchasing.receive.branchOriginHint')
            : t('operations:purchasing.receive.companyOriginHint')}
      </p>
      {branches.isError && (
        <p role='alert'>
          {errorMessage(branches.error)}{' '}
          <Button variant='outline' onClick={() => void branches.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {branches.isSuccess && activeBranches.length === 0 && (
        <p role='alert' className='text-sm text-destructive'>
          {t('operations:purchasing.receive.noActiveBranch')}
        </p>
      )}
      {draft && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && !save.isPending) setDraft(null)
          }}
        >
          <SheetContent className='flex w-full flex-col gap-0 sm:max-w-xl'>
            <SheetHeader>
              <SheetTitle>
                {t('operations:purchasing.receive.sheetTitle')}
              </SheetTitle>
              <SheetDescription>
                {t('operations:purchasing.receive.sheetDescription', {
                  version: draft.version,
                })}
              </SheetDescription>
            </SheetHeader>
            <form
              className='flex min-h-0 flex-1 flex-col'
              onSubmit={(event) => {
                event.preventDefault()
                if (save.isPending) return
                const items: ReceiveInput['items'] = []
                for (const row of draft.rows) {
                  // A deselected line is never sent, and a zero amount receives
                  // nothing, so neither can create a receive entry.
                  if (!row.selected) continue
                  const amountTicks = quantityTicks(row.amount)
                  if (amountTicks === null) {
                    setValidationError(
                      t('operations:purchasing.receive.invalidAmount', {
                        item: row.name,
                      })
                    )
                    return
                  }
                  if (amountTicks === 0) continue
                  const outstandingTicks =
                    quantityTicks(
                      subtractDecimalStrings(row.quantity, row.received)
                    ) ?? 0
                  if (amountTicks > outstandingTicks) {
                    setValidationError(
                      t('operations:purchasing.receive.overReceive', {
                        item: row.name,
                      })
                    )
                    return
                  }
                  if (row.branchUuid === null) {
                    setValidationError(
                      t('operations:purchasing.receive.chooseDestinationFor', {
                        item: row.name,
                      })
                    )
                    return
                  }
                  if (!activeBranchIds.has(row.branchUuid)) {
                    setValidationError(
                      t('operations:purchasing.receive.inactiveDestination', {
                        item: row.name,
                      })
                    )
                    return
                  }
                  items.push({
                    lineUuid: row.uuid,
                    branchUuid: row.branchUuid,
                    quantity: canonicalQuantity(amountTicks),
                  })
                }
                if (items.length === 0) {
                  setValidationError(
                    t('operations:purchasing.receive.selectOne')
                  )
                  return
                }
                try {
                  const signature = JSON.stringify({
                    version: draft.version,
                    items,
                  })
                  const requestKey =
                    draft.signature === signature && draft.requestKey !== null
                      ? draft.requestKey
                      : crypto.randomUUID()
                  const body = PurchasingModel.receiveInput.parse({
                    version: draft.version,
                    requestKey,
                    items,
                  })
                  setDraft((current) =>
                    current === null
                      ? null
                      : { ...current, requestKey, signature }
                  )
                  setValidationError(null)
                  save.mutate({
                    orderUuid: draft.orderUuid,
                    body,
                    branches: [
                      ...new Set(items.map((item) => item.branchUuid)),
                    ].map((uuid) => captureBranchScope(uuid)),
                    scope,
                    ui: captureBranchScope(selectedBranch?.branch.uuid ?? null),
                  })
                } catch (caught) {
                  setValidationError(errorMessage(caught))
                }
              }}
            >
              <div className='flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
                <div className='flex items-center gap-2'>
                  <Label htmlFor={bulkBranchId} className='text-sm font-normal'>
                    {t('operations:purchasing.receive.setAll')}
                  </Label>
                  <Select
                    disabled={save.isPending}
                    onValueChange={(value) => {
                      setDraft((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              rows: current.rows.map((row) => ({
                                ...row,
                                branchUuid: value,
                              })),
                              // A bulk destination change is a new intent.
                              requestKey: null,
                              signature: null,
                            }
                      )
                    }}
                  >
                    <SelectTrigger id={bulkBranchId} className='w-56'>
                      <SelectValue
                        placeholder={t(
                          'operations:purchasing.receive.chooseBranch'
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBranches.map((branch) => (
                        <SelectItem key={branch.uuid} value={branch.uuid}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <fieldset
                  disabled={save.isPending}
                  className='space-y-3 border-0 p-0'
                >
                  {draft.rows.map((row) => (
                    <ReceiveLineField
                      key={row.uuid}
                      row={row}
                      branches={activeBranches}
                      onChange={(patch) => updateRow(row.uuid, patch)}
                    />
                  ))}
                </fieldset>
                {(validationError != null || save.error != null) && (
                  <p role='alert' className='text-destructive'>
                    {validationError ?? errorMessage(save.error)}
                  </p>
                )}
              </div>
              <SheetFooter className='border-t'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDraft(null)}
                  disabled={save.isPending}
                >
                  {t('operations:common.cancel')}
                </Button>
                <Button type='submit' disabled={save.isPending}>
                  {save.isPending
                    ? t('operations:purchasing.receive.pending')
                    : t('operations:purchasing.receive.submit', {
                        count: selectedCount,
                      })}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}
