import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isPositiveDecimal, subtractDecimalStrings } from '@/lib/decimal-string'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

/** Stock quantities are Decimal(15,5): five digits after the point. */
const QUANTITY_SCALE = 5
const QUANTITY_TICKS = 10 ** QUANTITY_SCALE

/**
 * Exact decimal string to integer ticks at the quantity scale. A Decimal(15,5)
 * tops out at 999999999999999 ticks, below Number.MAX_SAFE_INTEGER, so the
 * slider stays integer-only and never sees a rounded float.
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
}

/**
 * Frozen copy of one sheet opening. The order uuid, version and amounts are
 * captured here so a background refresh cannot rebase old amounts onto a newer
 * version; a stale version stays a conflict and a reopen reads the latest lines.
 */
type ReceiveDraft = {
  orderUuid: string
  version: number
  rows: ReceiveRow[]
}

function receiveDraft(
  order: PurchaseOrder,
  lines: PurchaseLine[]
): ReceiveDraft {
  return {
    orderUuid: order.uuid,
    version: order.version,
    // Every line with a live item and an outstanding quantity starts selected
    // for its full outstanding amount. A line without an item cannot be
    // received, and a fully received line has nothing left to receive.
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
        },
      ]
    }),
  }
}

function ReceiveLineField({
  row,
  onChange,
}: {
  row: ReceiveRow
  onChange: (patch: Partial<ReceiveRow>) => void
}) {
  const outstanding = subtractDecimalStrings(row.quantity, row.received)
  const outstandingTicks = quantityTicks(outstanding) ?? 0
  const ticks = quantityTicks(row.amount)
  // A finer typed amount refines the step too, so the native range never
  // sanitizes the current value away from the exact amount beside it.
  const stepTicks =
    ticks === null
      ? quantityStepTicks(outstanding)
      : Math.min(quantityStepTicks(outstanding), quantityStepTicks(row.amount))
  const unit = row.unitCode ?? 'Unknown unit'
  const inputId = `receive-line-${row.uuid}`
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
            Ordered {row.quantity} · received {row.received} · outstanding{' '}
            {outstanding} {unit}
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
          aria-label={`Amount to receive for ${row.name}`}
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
          aria-label={`Exact amount to receive for ${row.name} (${unit})`}
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
  const [draft, setDraft] = useState<ReceiveDraft | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (input: {
      orderUuid: string
      body: ReceiveInput
      scope: string
    }) => purchasingApi.receive(input.orderUuid, input.body),
    onSuccess: async (result, input) => {
      await client.invalidateQueries({
        queryKey: ['purchasing', input.scope],
      })
      await invalidateItemStockCaches(client, input.scope)
      setDraft(null)
      toast.success(
        result.items.length === 1
          ? 'Item stock received'
          : `${result.items.length} items received`
      )
    },
    onError: async (caught, input) => {
      toast.error(errorMessage(caught))
      // The open draft stays frozen with its captured version and amounts; the
      // refresh only makes a later reopen read the current order and lines.
      await client.invalidateQueries({
        queryKey: ['purchasing', input.scope],
      })
    },
  })
  const receivable = receiveDraft(order, lines)
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
        <h2 className='text-xl font-semibold'>Receive</h2>
        {receivable.rows.length > 0 && (
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              setValidationError(null)
              save.reset()
              setDraft(receivable)
            }}
          >
            Receive stock
          </Button>
        )}
      </div>
      <p className='text-sm text-muted-foreground'>
        {receivable.rows.length === 0
          ? 'Nothing to receive: every line is fully received or has no item.'
          : 'Every outstanding line starts selected with its full outstanding quantity. Uncheck a line to skip it, or change its amount to receive a partial quantity. All selected lines are received in one request.'}
      </p>
      {draft && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && !save.isPending) setDraft(null)
          }}
        >
          <SheetContent className='flex w-full flex-col gap-0 sm:max-w-xl'>
            <SheetHeader>
              <SheetTitle>Receive stock</SheetTitle>
              <SheetDescription>
                Amounts are captured when this sheet opens against purchase
                order version {draft.version}, so a stale order cannot be
                received. Every selected line is received together, and each
                line keeps its own item and quantity.
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
                      `The amount for ${row.name} must be a decimal with up to five decimal places.`
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
                      `The amount for ${row.name} cannot exceed the outstanding quantity.`
                    )
                    return
                  }
                  items.push({
                    lineUuid: row.uuid,
                    quantity: canonicalQuantity(amountTicks),
                  })
                }
                if (items.length === 0) {
                  setValidationError(
                    'Select at least one line with a positive amount.'
                  )
                  return
                }
                try {
                  const body = PurchasingModel.receiveInput.parse({
                    version: draft.version,
                    items,
                  })
                  setValidationError(null)
                  save.mutate({
                    orderUuid: draft.orderUuid,
                    body,
                    scope: organizationCacheScope(),
                  })
                } catch (caught) {
                  setValidationError(errorMessage(caught))
                }
              }}
            >
              <div className='flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
                <fieldset
                  disabled={save.isPending}
                  className='space-y-3 border-0 p-0'
                >
                  {draft.rows.map((row) => (
                    <ReceiveLineField
                      key={row.uuid}
                      row={row}
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
                  Cancel
                </Button>
                <Button type='submit' disabled={save.isPending}>
                  {save.isPending
                    ? 'Receiving…'
                    : `Receive ${selectedCount} ${selectedCount === 1 ? 'line' : 'lines'}`}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}
