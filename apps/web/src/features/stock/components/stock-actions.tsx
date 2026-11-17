import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { t } from '@/lib/i18n'
import { invalidateBranchStockCaches } from '@/lib/item-stock-cache'
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
import { errorMessage, stockApi } from '../api'
import {
  StockPageModel,
  type StockBalance,
  type StockOperation,
} from '../model'
import type { BranchStockContext } from './stock-panel'

function operationLabel(operation: StockOperation) {
  if (operation === 'add') return t('catalog:stock.actions.add')
  if (operation === 'remove') return t('catalog:stock.actions.remove')
  return t('catalog:stock.actions.count')
}

type StockDraft = {
  balance: StockBalance
  operation: StockOperation
  captured: CapturedBranchScope
}

type CountOrRemove = {
  operation: 'remove' | 'count'
  quantity: string
  notes?: string
}

function StockAdjustSheet({
  balance,
  branchName,
  operation,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  balance: StockBalance
  branchName: string
  operation: StockOperation
  pending: boolean
  error: unknown
  onSubmit: (quantity: string, notes?: string) => void
  onClose: () => void
}) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const label = operationLabel(operation)
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
            {t('catalog:stock.actions.sheetDescription', {
              item: balance.name,
              branch: branchName,
              stock: balance.stock,
              version: balance.version,
            })}
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
                label:
                  operation === 'count'
                    ? t('catalog:stock.actions.countedQuantity')
                    : t('catalog:stock.actions.quantity'),
                required: true,
                pattern: '\\d*[.,]\\d{1,5}|\\d+',
              }}
              value={operation === 'count' ? balance.stock : undefined}
            />
            <FieldInput
              field={{
                name: 'notes',
                label: t('catalog:stock.actions.notes'),
                maxLength: 512,
              }}
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
              {t('catalog:common.cancel')}
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

export function ItemStockActions({
  balance,
  branch,
}: {
  balance: StockBalance
  branch: BranchStockContext
}) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<StockDraft | null>(null)
  const [confirmation, setConfirmation] = useState<CountOrRemove | null>(null)
  const disabled = !branch.active
  const adjustment = useMutation({
    mutationFn: (input: {
      itemUuid: string
      branchUuid: string
      version: number
      operation: StockOperation
      quantity: string
      notes?: string
      captured: CapturedBranchScope
    }) =>
      stockApi.adjust(input.itemUuid, input.branchUuid, input.operation, {
        version: input.version,
        quantity: input.quantity,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
      }),
    onSuccess: async (_next, input) => {
      await invalidateBranchStockCaches(client, input.captured)
      if (!isBranchScopeCurrent(input.captured)) return
      setConfirmation(null)
      setDraft(null)
      toast.success(
        input.operation === 'count'
          ? t('catalog:stock.actions.countedToast')
          : input.operation === 'add'
            ? t('catalog:stock.actions.addedToast')
            : t('catalog:stock.actions.removedToast')
      )
    },
    onError: () => setConfirmation(null),
  })
  const captured = draft
  const openDraft = (operation: StockOperation) => {
    adjustment.reset()
    setDraft({
      balance,
      operation,
      captured: captureBranchScope(branch.uuid),
    })
  }
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={adjustment.isPending || disabled}
          onClick={() => openDraft('add')}
        >
          {t('catalog:stock.actions.add')}
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={adjustment.isPending || disabled}
          onClick={() => openDraft('remove')}
        >
          {t('catalog:stock.actions.remove')}
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={adjustment.isPending || disabled}
          onClick={() => openDraft('count')}
        >
          {t('catalog:stock.actions.count')}
        </Button>
      </div>
      {captured != null && (
        <StockAdjustSheet
          key={`${captured.balance.itemUuid}:${captured.operation}:${captured.captured.scope}`}
          balance={captured.balance}
          branchName={branch.name}
          operation={captured.operation}
          pending={adjustment.isPending}
          error={adjustment.error}
          onSubmit={(quantity, notes) => {
            if (adjustment.isPending) return
            const operation = captured.operation
            if (operation === 'add') {
              adjustment.mutate({
                itemUuid: captured.balance.itemUuid,
                branchUuid: branch.uuid,
                version: captured.balance.version,
                operation,
                quantity,
                captured: captured.captured,
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
          confirmation?.operation === 'count'
            ? t('catalog:stock.actions.countTitle')
            : t('catalog:stock.actions.removeTitle')
        }
        desc={
          confirmation == null || captured == null
            ? ''
            : confirmation.operation === 'count'
              ? t('catalog:stock.actions.countDescription', {
                  item: captured.balance.name,
                  branch: branch.name,
                  quantity: confirmation.quantity,
                })
              : t('catalog:stock.actions.removeDescription', {
                  item: captured.balance.name,
                  branch: branch.name,
                  quantity: confirmation.quantity,
                  stock: captured.balance.stock,
                })
        }
        confirmText={
          confirmation?.operation === 'count'
            ? t('catalog:stock.actions.countConfirm')
            : t('catalog:stock.actions.removeConfirm')
        }
        destructive
        isLoading={adjustment.isPending}
        handleConfirm={() => {
          if (captured == null || confirmation == null) return
          adjustment.mutate({
            itemUuid: captured.balance.itemUuid,
            branchUuid: branch.uuid,
            version: captured.balance.version,
            operation: confirmation.operation,
            quantity: confirmation.quantity,
            captured: captured.captured,
            ...(confirmation.notes === undefined
              ? {}
              : { notes: confirmation.notes }),
          })
        }}
      />
    </>
  )
}
