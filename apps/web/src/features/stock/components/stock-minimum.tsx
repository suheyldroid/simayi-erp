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
import { FieldInput } from '@/components/field-input'
import { errorMessage, stockApi } from '../api'
import { StockPageModel, type StockBalance } from '../model'

/**
 * Minimum stock belongs to one branch balance, not to the shared item. The
 * captured balance version is sent with the exact decimal string so a stale
 * form cannot overwrite a newer balance.
 */
export function StockMinimumSheet({
  balance,
  branch,
  onClose,
}: {
  balance: StockBalance
  branch: { uuid: string; name: string; active: boolean }
  onClose: () => void
}) {
  const client = useQueryClient()
  const [validationError, setValidationError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (input: {
      minimumStock: string
      captured: CapturedBranchScope
    }) =>
      stockApi.updateMinimum(balance.itemUuid, branch.uuid, {
        version: balance.version,
        minimumStock: input.minimumStock,
      }),
    onSuccess: async (_next, input) => {
      await invalidateBranchStockCaches(client, input.captured)
      if (!isBranchScopeCurrent(input.captured)) return
      onClose()
      toast.success(
        t('catalog:stock.minimum.savedToast', { branch: branch.name })
      )
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose()
      }}
    >
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-md'
        onEscapeKeyDown={(event) => {
          if (save.isPending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (save.isPending) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>{t('catalog:stock.minimum.title')}</SheetTitle>
          <SheetDescription>
            {t('catalog:stock.minimum.description', {
              item: balance.name,
              branch: branch.name,
            })}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (save.isPending) return
            const form = new FormData(event.currentTarget)
            try {
              const parsed = StockPageModel.minimumInput.parse({
                minimumStock: String(form.get('minimumStock') ?? ''),
              })
              setValidationError(null)
              save.mutate({
                minimumStock: parsed.minimumStock,
                captured: captureBranchScope(branch.uuid),
              })
            } catch (caught) {
              setValidationError(errorMessage(caught))
            }
          }}
        >
          <fieldset
            disabled={save.isPending || !branch.active}
            className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'
          >
            {!branch.active && (
              <p role='alert' className='text-sm text-destructive'>
                {t('catalog:stock.minimum.inactiveAlert')}
              </p>
            )}
            <FieldInput
              field={{
                name: 'minimumStock',
                label: t('catalog:stock.minimum.quantityLabel'),
                required: true,
                pattern: '\\d+([.,]\\d{1,6})?',
                maxLength: 26,
              }}
              value={balance.minimumStock}
            />
            <p className='text-sm text-muted-foreground'>
              {t('catalog:stock.minimum.balanceLine', {
                version: balance.version,
                stock: balance.stock,
                unit: balance.units ? ` ${balance.units}` : '',
              })}
            </p>
            {validationError != null && (
              <p role='alert' className='text-destructive'>
                {validationError}
              </p>
            )}
            {save.error != null && (
              <p role='alert' className='text-destructive'>
                {errorMessage(save.error)}
              </p>
            )}
          </fieldset>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={save.isPending}
            >
              {t('catalog:common.cancel')}
            </Button>
            <Button type='submit' disabled={save.isPending || !branch.active}>
              {t('catalog:stock.minimum.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
