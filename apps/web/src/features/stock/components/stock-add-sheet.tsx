import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { FieldInput } from '@/components/field-input'
import { errorMessage } from '@/features/items/api'
import {
  ItemSelect,
  type ItemOption,
} from '@/features/items/components/item-select'
import { stockApi } from '../api'
import { branchStockBalanceKey } from '../cache'
import { StockPageModel } from '../model'
import type { BranchStockContext } from './stock-panel'

type AddRequest = {
  itemUuid: string
  branchUuid: string
  version: number
  quantity: string
  notes?: string
  captured: CapturedBranchScope
}

/**
 * Branch stock entry form. The picked item is only an option; one real branch
 * balance read captures the uuid, balance and branch version used for the
 * submit intent. A failed submission retries with that same captured version
 * instead of reading a newer version that could double-add a committed
 * adjustment.
 */
export function StockAddSheet({
  branch,
  onClose,
}: {
  branch: BranchStockContext
  onClose: () => void
}) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<ItemOption | null>(null)
  const [submittedVersion, setSubmittedVersion] = useState<number | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const detail = useQuery({
    queryKey: branchStockBalanceKey(branch.uuid, selected?.uuid ?? 'none'),
    queryFn: () => stockApi.balance(selected?.uuid as string, branch.uuid),
    enabled: selected != null,
    refetchOnWindowFocus: false,
  })
  const addition = useMutation({
    mutationFn: (request: AddRequest) =>
      stockApi.adjust(request.itemUuid, request.branchUuid, 'add', {
        version: request.version,
        quantity: request.quantity,
        ...(request.notes === undefined ? {} : { notes: request.notes }),
      }),
    onSuccess: async (next, request) => {
      await invalidateBranchStockCaches(client, request.captured)
      if (!isBranchScopeCurrent(request.captured)) return
      onClose()
      toast.success(
        t('catalog:stock.addSheet.addedToast', {
          item: next.name,
          branch: branch.name,
        })
      )
    },
  })
  const live = detail.data
  const unavailable =
    detail.isPending || detail.isFetching || detail.isError || live == null
  const unitUnresolved = live != null && live.unitUuid == null
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !addition.isPending) onClose()
      }}
    >
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-md'
        onEscapeKeyDown={(event) => {
          if (addition.isPending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (addition.isPending) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>{t('catalog:stock.addSheet.title')}</SheetTitle>
          <SheetDescription>
            {t('catalog:stock.addSheet.description', { branch: branch.name })}
          </SheetDescription>
        </SheetHeader>
        <form
          key={selected?.uuid ?? 'none'}
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (addition.isPending || unavailable || live == null) return
            const form = new FormData(event.currentTarget)
            const notes = String(form.get('notes') ?? '').trim()
            try {
              const parsed = StockPageModel.addInput.parse({
                quantity: String(form.get('quantity') ?? ''),
                ...(notes === '' ? {} : { notes }),
              })
              const version = submittedVersion ?? live.version
              setSubmittedVersion(version)
              setValidationError(null)
              addition.mutate({
                itemUuid: live.itemUuid,
                branchUuid: branch.uuid,
                version,
                quantity: parsed.quantity,
                captured: captureBranchScope(branch.uuid),
                ...(parsed.notes === undefined ? {} : { notes: parsed.notes }),
              })
            } catch (error) {
              setValidationError(errorMessage(error))
            }
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <ItemSelect
              label={t('catalog:stock.addSheet.itemLabel')}
              value={selected}
              activeOnly={false}
              disabled={addition.isPending}
              onChange={(next) => {
                if (next?.uuid !== selected?.uuid) {
                  setSubmittedVersion(null)
                  setValidationError(null)
                  addition.reset()
                }
                setSelected(next)
              }}
            />
            {selected != null && detail.isPending && (
              <p role='status'>{t('catalog:stock.panel.loadingBalance')}</p>
            )}
            {selected != null && detail.isError && (
              <p role='alert'>
                {errorMessage(detail.error)}{' '}
                <Button variant='outline' onClick={() => void detail.refetch()}>
                  {t('catalog:common.retry')}
                </Button>
              </p>
            )}
            {live && !detail.isError && (
              <p className='text-sm text-muted-foreground'>
                {t('catalog:stock.addSheet.balanceLine', {
                  item: live.name,
                  branch: branch.name,
                  stock: live.stock,
                  unit: live.units
                    ? ` ${live.units}`
                    : t('catalog:stock.addSheet.unitUnresolvedSuffix'),
                  minimum: live.minimumStock,
                  version: live.version,
                })}
              </p>
            )}
            {live && !detail.isError && unitUnresolved && (
              <p role='alert' className='text-sm text-destructive'>
                {t('catalog:stock.addSheet.unitUnresolvedAlert')}
              </p>
            )}
            {addition.error != null && (
              <div role='alert' className='space-y-2 text-destructive'>
                <p>{errorMessage(addition.error)}</p>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={addition.isPending}
                  onClick={() => {
                    setSubmittedVersion(null)
                    addition.reset()
                    void detail.refetch()
                  }}
                >
                  {t('catalog:stock.addSheet.reloadBalance')}
                </Button>
              </div>
            )}
            <fieldset
              disabled={addition.isPending || live == null || unitUnresolved}
              className='space-y-3'
            >
              <FieldInput
                field={{
                  name: 'quantity',
                  label: t('catalog:stock.addSheet.quantityToAdd'),
                  required: true,
                  pattern: '\\d*[.,]\\d{1,5}|\\d+',
                }}
              />
              <FieldInput
                field={{
                  name: 'notes',
                  label: t('catalog:stock.actions.notes'),
                  maxLength: 512,
                }}
              />
            </fieldset>
            {validationError != null && (
              <p role='alert' className='text-destructive'>
                {validationError}
              </p>
            )}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={addition.isPending}
            >
              {t('catalog:common.cancel')}
            </Button>
            <Button
              type='submit'
              disabled={addition.isPending || unavailable || unitUnresolved}
            >
              {t('catalog:stock.addSheet.title')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
