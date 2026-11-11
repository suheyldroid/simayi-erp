import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
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
import { FieldInput } from '@/components/field-input'
import type { Item } from '@/features/items/model'
import { errorMessage, stockApi } from '../api'
import { StockPageModel, type StockOperation } from '../model'

const operationLabels: Record<StockOperation, string> = {
  add: 'Add stock',
  remove: 'Remove stock',
  count: 'Count stock',
}

type StockDraft = { item: Item; operation: StockOperation; scope: string }

type CountOrRemove = {
  operation: 'remove' | 'count'
  quantity: string
  notes?: string
}

function StockAdjustSheet({
  item,
  operation,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  item: Item
  operation: StockOperation
  pending: boolean
  error: unknown
  onSubmit: (quantity: string, notes?: string) => void
  onClose: () => void
}) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const label = operationLabels[operation]
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-md'
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>
            {item.name} · current stock {item.stock} · version {item.version}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            const form = new FormData(event.currentTarget)
            const notes = String(form.get('notes') ?? '').trim()
            try {
              const rawQuantity = String(form.get('quantity') ?? '')
              const quantity =
                operation === 'count'
                  ? StockPageModel.countInput.shape.quantity.parse(rawQuantity)
                  : StockPageModel.addInput.shape.quantity.parse(rawQuantity)
              setValidationError(null)
              onSubmit(quantity, notes === '' ? undefined : notes)
            } catch (caught) {
              setValidationError(errorMessage(caught))
            }
          }}
        >
          <fieldset
            disabled={pending}
            className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'
          >
            <FieldInput
              field={{
                name: 'quantity',
                label: operation === 'count' ? 'Counted quantity' : 'Quantity',
                required: true,
                pattern: '\\d*[.,]\\d{1,5}|\\d+',
              }}
              value={operation === 'count' ? item.stock : undefined}
            />
            <FieldInput
              field={{ name: 'notes', label: 'Notes', maxLength: 512 }}
            />
            {validationError != null && (
              <p role='alert' className='text-destructive'>
                {validationError}
              </p>
            )}
            {error != null && (
              <p role='alert' className='text-destructive'>
                {errorMessage(error)}
              </p>
            )}
          </fieldset>
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
              {label}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function ItemStockActions({ item }: { item: Item }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<StockDraft | null>(null)
  const [confirmation, setConfirmation] = useState<CountOrRemove | null>(null)
  const adjustment = useMutation({
    mutationFn: (input: {
      itemUuid: string
      version: number
      operation: StockOperation
      quantity: string
      notes?: string
      scope: string
    }) =>
      stockApi.adjust(input.itemUuid, input.operation, {
        version: input.version,
        quantity: input.quantity,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
      }),
    onSuccess: async (_next, input) => {
      await invalidateItemStockCaches(client, input.scope)
      setConfirmation(null)
      setDraft(null)
      toast.success(
        input.operation === 'count'
          ? 'Stock counted'
          : input.operation === 'add'
            ? 'Stock added'
            : 'Stock removed'
      )
    },
    onError: () => setConfirmation(null),
  })
  const captured = draft
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={adjustment.isPending}
          onClick={() => {
            adjustment.reset()
            setDraft({
              item,
              operation: 'add',
              scope: organizationCacheScope(),
            })
          }}
        >
          Add stock
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={adjustment.isPending}
          onClick={() => {
            adjustment.reset()
            setDraft({
              item,
              operation: 'remove',
              scope: organizationCacheScope(),
            })
          }}
        >
          Remove stock
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={adjustment.isPending}
          onClick={() => {
            adjustment.reset()
            setDraft({
              item,
              operation: 'count',
              scope: organizationCacheScope(),
            })
          }}
        >
          Count stock
        </Button>
      </div>
      {captured != null && (
        <StockAdjustSheet
          key={`${captured.item.uuid}:${captured.operation}`}
          item={captured.item}
          operation={captured.operation}
          pending={adjustment.isPending}
          error={adjustment.error}
          onSubmit={(quantity, notes) => {
            if (adjustment.isPending) return
            const operation = captured.operation
            if (operation === 'add') {
              adjustment.mutate({
                itemUuid: captured.item.uuid,
                version: captured.item.version,
                operation,
                quantity,
                scope: captured.scope,
                ...(notes === undefined ? {} : { notes }),
              })
              return
            }
            setConfirmation({ operation, quantity, notes })
          }}
          onClose={() => {
            if (adjustment.isPending) return
            setConfirmation(null)
            setDraft(null)
            adjustment.reset()
          }}
        />
      )}
      <ConfirmDialog
        open={confirmation != null}
        onOpenChange={(open) => {
          if (!open && !adjustment.isPending) setConfirmation(null)
        }}
        title={
          confirmation?.operation === 'count' ? 'Count stock' : 'Remove stock'
        }
        desc={
          confirmation == null || captured == null
            ? ''
            : confirmation.operation === 'count'
              ? `Set ${captured.item.name} stock to ${confirmation.quantity}? This records a counted balance.`
              : `Remove ${confirmation.quantity} from ${captured.item.name} (current stock ${captured.item.stock})?`
        }
        confirmText={confirmation?.operation === 'count' ? 'Count' : 'Remove'}
        destructive
        isLoading={adjustment.isPending}
        handleConfirm={() => {
          if (captured == null || confirmation == null) return
          adjustment.mutate({
            itemUuid: captured.item.uuid,
            version: captured.item.version,
            operation: confirmation.operation,
            quantity: confirmation.quantity,
            scope: captured.scope,
            ...(confirmation.notes === undefined
              ? {}
              : { notes: confirmation.notes }),
          })
        }}
      />
    </>
  )
}
