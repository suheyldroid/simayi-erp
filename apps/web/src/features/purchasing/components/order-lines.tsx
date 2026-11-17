import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { isPositiveDecimal, subtractDecimalStrings } from '@/lib/decimal-string'
import { t } from '@/lib/i18n'
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
          <SheetTitle>
            {t('operations:purchasing.lines.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('operations:purchasing.lines.createDescription', {
              currency: systemCurrency ?? t('operations:common.notConfigured'),
            })}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (!item) {
              setValidationError(t('operations:purchasing.lines.chooseItem'))
              return
            }
            if (!item.units) {
              setValidationError(
                t('operations:purchasing.lines.missingUnit', {
                  item: item.name,
                })
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
                label={t('operations:purchasing.lines.item')}
                value={item}
                activeOnly={false}
                disabled={pending}
                onChange={setItem}
              />
              <div className='space-y-2'>
                <FieldInput
                  field={{
                    name: 'quantity',
                    label: t('operations:purchasing.lines.quantity'),
                    required: true,
                  }}
                />
                <p className='text-xs text-muted-foreground'>
                  {item
                    ? t('operations:purchasing.lines.unitHint', {
                        unit:
                          item.units || t('operations:common.unresolvedUnit'),
                      })
                    : t('operations:purchasing.lines.unitPlaceholder')}
                </p>
              </div>
              <FieldInput
                field={{
                  name: 'purchasePrice',
                  label: t('operations:purchasing.lines.unitPrice', {
                    currency:
                      systemCurrency ??
                      t('operations:purchasing.systemCurrency'),
                  }),
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
              {t('operations:common.cancel')}
            </Button>
            <Button type='submit' disabled={pending}>
              {t('operations:purchasing.lines.submit')}
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
  const selectedBranch = useOptionalBranch()
  const [adding, setAdding] = useState(false)
  const [removeLine, setRemoveLine] = useState<PurchaseLine | null>(null)
  const save = useMutation({
    mutationFn: (input: {
      body: LineInput
      scope: string
      ui: CapturedBranchScope
    }) => purchasingApi.addLine(order.uuid, input.body),
    onSuccess: async (_line, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      // The line write refreshes the finance reservation of the order.
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      if (!isBranchScopeCurrent(input.ui)) return
      setAdding(false)
      toast.success(t('operations:purchasing.lines.added'))
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  const remove = useMutation({
    mutationFn: (input: {
      line: PurchaseLine
      scope: string
      ui: CapturedBranchScope
    }) => purchasingApi.removeLine(order.uuid, input.line.uuid, order.version),
    onSuccess: async (_result, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      // The line write refreshes the finance reservation of the order.
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      if (!isBranchScopeCurrent(input.ui)) return
      setRemoveLine(null)
      toast.success(t('operations:purchasing.lines.deleted'))
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  // A line with any receipt or reversal event cannot be deleted, even when its
  // net received quantity is back to zero.
  const canRemoveLine =
    removeLine !== null &&
    editable &&
    !isPositiveDecimal(removeLine.received) &&
    removeLine.receiptEventCount === 0
  const columns: SortableColumn<PurchaseLine>[] = [
    {
      id: 'item',
      header: t('operations:purchasing.lines.item'),
      accessorFn: (line) => line.item?.name ?? '',
      cell: ({ row }) => row.original.item?.name ?? '—',
    },
    {
      id: 'ipn',
      header: t('operations:purchasing.lines.ipn'),
      // Free-form codes: the numeric collator misorders dotted fractions, so
      // this column stays unsorted instead of promising an order it cannot keep.
      enableSorting: false,
      accessorFn: (line) => line.item?.ipn ?? '',
      cell: ({ row }) => row.original.item?.ipn || '—',
    },
    {
      id: 'quantity',
      header: t('operations:purchasing.lines.ordered'),
      // Exact decimal strings stay strings; sorting them through Number() would
      // corrupt the order, so every quantity column is unsorted.
      enableSorting: false,
      meta: { numeric: true },
      accessorFn: (line) => line.quantity,
      cell: ({ row }) => row.original.quantity,
    },
    {
      id: 'received',
      header: t('operations:purchasing.lines.received'),
      enableSorting: false,
      meta: { numeric: true },
      accessorFn: (line) => line.received,
      cell: ({ row }) => row.original.received,
    },
    {
      id: 'outstanding',
      header: t('operations:purchasing.lines.outstanding'),
      enableSorting: false,
      meta: { numeric: true },
      cell: ({ row }) =>
        subtractDecimalStrings(row.original.quantity, row.original.received),
    },
    {
      id: 'unit',
      header: t('operations:purchasing.lines.unit'),
      accessorFn: (line) => line.unitCode ?? '',
      cell: ({ row }) =>
        row.original.unitCode ?? t('operations:common.unknownUnit'),
    },
    {
      id: 'price',
      header: t('operations:purchasing.lines.unitPriceColumn'),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.purchasePrice == null
          ? '—'
          : `${row.original.purchasePrice} ${
              row.original.currencyCode ??
              t('operations:common.unknownCurrency')
            }`,
    },
    {
      id: 'actions',
      header: t('operations:purchasing.lines.actions'),
      enableSorting: false,
      cell: ({ row }) =>
        editable &&
        !isPositiveDecimal(row.original.received) &&
        row.original.receiptEventCount === 0 ? (
          <Button
            type='button'
            variant='outline'
            disabled={remove.isPending}
            onClick={() => setRemoveLine(row.original)}
          >
            {t('operations:common.delete')}
          </Button>
        ) : null,
    },
  ]
  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>
          {t('operations:purchasing.lines.title')}
        </h2>
        {editable && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setAdding(true)}
          >
            {t('operations:purchasing.lines.add')}
          </Button>
        )}
      </div>
      {pending && (
        <p role='status'>{t('operations:purchasing.lines.loading')}</p>
      )}
      {error != null && (
        <p role='alert'>
          {errorMessage(error)}{' '}
          <Button variant='outline' onClick={onRetry}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {!pending && error == null && (
        <SortableDataTable
          data={lines}
          columns={columns}
          getRowId={(line) => line.uuid}
          caption={t('operations:purchasing.lines.caption')}
          emptyMessage={t('operations:purchasing.lines.empty')}
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
            save.mutate({
              body,
              scope: organizationCacheScope(),
              ui: captureBranchScope(selectedBranch?.branch.uuid ?? null),
            })
          }
        />
      )}
      <ConfirmDialog
        open={canRemoveLine}
        onOpenChange={(open) => {
          if (!open) setRemoveLine(null)
        }}
        title={t('operations:purchasing.lines.deleteTitle')}
        desc={t('operations:purchasing.lines.deleteDescription')}
        confirmText={t('operations:common.delete')}
        destructive
        disabled={!canRemoveLine}
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (
            removeLine === null ||
            !editable ||
            isPositiveDecimal(removeLine.received) ||
            removeLine.receiptEventCount > 0
          )
            return
          remove.mutate({
            line: removeLine,
            scope: organizationCacheScope(),
            ui: captureBranchScope(selectedBranch?.branch.uuid ?? null),
          })
        }}
      />
    </section>
  )
}
