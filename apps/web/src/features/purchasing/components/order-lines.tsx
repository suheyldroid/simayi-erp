import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isPositiveDecimal, subtractDecimalStrings } from '@/lib/decimal-string'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { FieldInput } from '@/components/field-input'
import {
  ItemSelect,
  type ItemOption,
} from '@/features/items/components/item-select'
import { errorMessage, purchasingApi } from '../api'
import {
  PurchasingModel,
  type LineInput,
  type PurchaseLine,
  type PurchaseOrder,
} from '../model'

function PurchaseLineForm({
  version,
  systemCurrency,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  version: number
  systemCurrency: string | null
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: LineInput) => void
}) {
  const [item, setItem] = useState<ItemOption | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>Add line</SheetTitle>
          <SheetDescription>
            An item and its ordered quantity in the item's stock unit. A written
            price uses the fixed system currency (
            {systemCurrency ?? 'not configured'}). The order version is sent
            with the line so a stale order cannot be changed.
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (!item) {
              setValidationError('Choose an item')
              return
            }
            if (!item.units) {
              setValidationError(
                `${item.name} has no unit assigned. Assign a unit in Items before ordering it.`
              )
              return
            }
            const form = new FormData(event.currentTarget)
            const price = String(form.get('purchasePrice') ?? '').trim()
            try {
              const body = PurchasingModel.lineInput.parse({
                version,
                itemUuid: item.uuid,
                quantity: String(form.get('quantity') ?? ''),
                ...(price === '' ? {} : { purchasePrice: price }),
              })
              setValidationError(null)
              onSubmit(body)
            } catch (caught) {
              setValidationError(errorMessage(caught))
            }
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <ItemSelect
                label='Item'
                value={item}
                activeOnly={false}
                disabled={pending}
                onChange={setItem}
              />
              <div className='space-y-2'>
                <FieldInput
                  field={{
                    name: 'quantity',
                    label: 'Quantity',
                    required: true,
                  }}
                />
                <p className='text-xs text-muted-foreground'>
                  {item
                    ? `Ordered in ${item.units || 'an unresolved unit'}.`
                    : 'Choose an item to see its unit.'}
                </p>
              </div>
              <FieldInput
                field={{
                  name: 'purchasePrice',
                  label: `Unit price (${systemCurrency ?? 'system currency'})`,
                }}
              />
            </fieldset>
            {(validationError != null || error != null) && (
              <p role='alert' className='text-destructive'>
                {validationError ?? errorMessage(error)}
              </p>
            )}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={pending}>
              Add line
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function OrderLines({
  order,
  lines,
  systemCurrency,
  pending,
  error,
  editable,
  onRetry,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
  systemCurrency: string | null
  pending: boolean
  error: unknown
  editable: boolean
  onRetry: () => void
}) {
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [removeLine, setRemoveLine] = useState<PurchaseLine | null>(null)
  const save = useMutation({
    mutationFn: (input: { body: LineInput; scope: string }) =>
      purchasingApi.addLine(order.uuid, input.body),
    onSuccess: async (_line, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      // The line write refreshes the finance reservation of the order.
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      setAdding(false)
      toast.success('Line added')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (input: { line: PurchaseLine; scope: string }) =>
      purchasingApi.removeLine(order.uuid, input.line.uuid, order.version),
    onSuccess: async (_result, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      // The line write refreshes the finance reservation of the order.
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      setRemoveLine(null)
      toast.success('Line deleted')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const canRemoveLine =
    removeLine !== null && editable && !isPositiveDecimal(removeLine.received)
  const columns: SortableColumn<PurchaseLine>[] = [
    {
      id: 'item',
      header: 'Item',
      accessorFn: (line) => line.item?.name ?? '',
      cell: ({ row }) => row.original.item?.name ?? '—',
    },
    {
      id: 'ipn',
      header: 'IPN',
      // Free-form codes: the numeric collator misorders dotted fractions, so
      // this column stays unsorted instead of promising an order it cannot keep.
      enableSorting: false,
      accessorFn: (line) => line.item?.ipn ?? '',
      cell: ({ row }) => row.original.item?.ipn || '—',
    },
    {
      id: 'quantity',
      header: 'Ordered',
      // Exact decimal strings stay strings; sorting them through Number() would
      // corrupt the order, so every quantity column is unsorted.
      enableSorting: false,
      meta: { numeric: true },
      accessorFn: (line) => line.quantity,
      cell: ({ row }) => row.original.quantity,
    },
    {
      id: 'received',
      header: 'Received',
      enableSorting: false,
      meta: { numeric: true },
      accessorFn: (line) => line.received,
      cell: ({ row }) => row.original.received,
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) =>
        subtractDecimalStrings(row.original.quantity, row.original.received),
    },
    {
      id: 'unit',
      header: 'Unit',
      accessorFn: (line) => line.unitCode ?? '',
      cell: ({ row }) => row.original.unitCode ?? 'Unknown unit',
    },
    {
      id: 'price',
      header: 'Unit price',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.purchasePrice == null
          ? '—'
          : `${row.original.purchasePrice} ${row.original.currencyCode ?? 'Unknown currency'}`,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) =>
        editable && !isPositiveDecimal(row.original.received) ? (
          <Button
            type='button'
            variant='outline'
            disabled={remove.isPending}
            onClick={() => setRemoveLine(row.original)}
          >
            Delete
          </Button>
        ) : null,
    },
  ]
  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>Lines</h2>
        {editable && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setAdding(true)}
          >
            Add line
          </Button>
        )}
      </div>
      {pending && <p role='status'>Loading lines…</p>}
      {error != null && (
        <p role='alert'>
          {errorMessage(error)}{' '}
          <Button variant='outline' onClick={onRetry}>
            Retry
          </Button>
        </p>
      )}
      {!pending && error == null && (
        <SortableDataTable
          data={lines}
          columns={columns}
          getRowId={(line) => line.uuid}
          caption='Purchase order lines'
          emptyMessage='No lines yet.'
        />
      )}
      {editable && adding && (
        <PurchaseLineForm
          version={order.version}
          systemCurrency={systemCurrency}
          pending={save.isPending}
          error={save.error}
          onClose={() => setAdding(false)}
          onSubmit={(body) =>
            save.mutate({ body, scope: organizationCacheScope() })
          }
        />
      )}
      <ConfirmDialog
        open={canRemoveLine}
        onOpenChange={(open) => {
          if (!open) setRemoveLine(null)
        }}
        title='Delete purchase order line'
        desc='A line can be deleted only while no stock has been received for it.'
        confirmText='Delete'
        destructive
        disabled={!canRemoveLine}
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (
            removeLine === null ||
            !editable ||
            isPositiveDecimal(removeLine.received)
          )
            return
          remove.mutate({
            line: removeLine,
            scope: organizationCacheScope(),
          })
        }}
      />
    </section>
  )
}
