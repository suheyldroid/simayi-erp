import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldInput } from '@/components/field-input'
import { errorMessage, purchasingApi } from '../api'
import {
  PurchasingModel,
  type ExtraInput,
  type PurchaseExtra,
  type PurchaseOrder,
} from '../model'

function PurchaseExtraForm({
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
  onSubmit: (body: ExtraInput) => void
}) {
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
            {t('operations:purchasing.extras.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('operations:purchasing.extras.createDescription', {
              currency: systemCurrency ?? t('operations:common.notConfigured'),
            })}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const description = String(form.get('description') ?? '').trim()
            const price = String(form.get('price') ?? '').trim()
            try {
              const body = PurchasingModel.extraInput.parse({
                version,
                quantity: String(form.get('quantity') ?? ''),
                ...(description === '' ? {} : { description }),
                ...(price === '' ? {} : { price }),
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
              <FieldInput
                field={{
                  name: 'description',
                  label: t('operations:purchasing.extras.description'),
                  maxLength: 250,
                }}
              />
              <FieldInput
                field={{
                  name: 'quantity',
                  label: t('operations:purchasing.extras.quantity'),
                  required: true,
                }}
              />
              <FieldInput
                field={{
                  name: 'price',
                  label: t('operations:purchasing.extras.price', {
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
              {t('operations:purchasing.extras.submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function OrderExtras({
  order,
  extras,
  systemCurrency,
  pending,
  error,
  editable,
  onRetry,
}: {
  order: PurchaseOrder
  extras: PurchaseExtra[]
  systemCurrency: string | null
  pending: boolean
  error: unknown
  editable: boolean
  onRetry: () => void
}) {
  const client = useQueryClient()
  const selectedBranch = useOptionalBranch()
  const [adding, setAdding] = useState(false)
  const [removeExtra, setRemoveExtra] = useState<PurchaseExtra | null>(null)
  const save = useMutation({
    mutationFn: (input: {
      body: ExtraInput
      scope: string
      ui: CapturedBranchScope
    }) => purchasingApi.addExtra(order.uuid, input.body),
    onSuccess: async (_extra, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      // The extra-line write refreshes the finance reservation of the order.
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      if (!isBranchScopeCurrent(input.ui)) return
      setAdding(false)
      toast.success(t('operations:purchasing.extras.added'))
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  const remove = useMutation({
    mutationFn: (input: {
      extra: PurchaseExtra
      scope: string
      ui: CapturedBranchScope
    }) =>
      purchasingApi.removeExtra(order.uuid, input.extra.uuid, order.version),
    onSuccess: async (_result, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      // The extra-line write refreshes the finance reservation of the order.
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      if (!isBranchScopeCurrent(input.ui)) return
      setRemoveExtra(null)
      toast.success(t('operations:purchasing.extras.deleted'))
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  const canRemoveExtra = removeExtra !== null && editable
  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>
          {t('operations:purchasing.extras.title')}
        </h2>
        {editable && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setAdding(true)}
          >
            {t('operations:purchasing.extras.add')}
          </Button>
        )}
      </div>
      {pending && (
        <p role='status'>{t('operations:purchasing.extras.loading')}</p>
      )}
      {error != null && (
        <p role='alert'>
          {errorMessage(error)}{' '}
          <Button variant='outline' onClick={onRetry}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {t('operations:purchasing.extras.description')}
            </TableHead>
            <TableHead>{t('operations:purchasing.extras.quantity')}</TableHead>
            <TableHead>
              {t('operations:purchasing.extras.priceColumn')}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {extras.map((line) => (
            <TableRow key={line.uuid}>
              <TableCell>{line.description || '—'}</TableCell>
              <TableCell>{line.quantity}</TableCell>
              <TableCell>
                {line.price == null
                  ? '—'
                  : `${line.price} ${
                      line.currencyCode ??
                      t('operations:common.unknownCurrency')
                    }`}
              </TableCell>
              <TableCell>
                {editable && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={remove.isPending}
                    onClick={() => setRemoveExtra(line)}
                  >
                    {t('operations:common.delete')}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {extras.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                {t('operations:purchasing.extras.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {editable && adding && (
        <PurchaseExtraForm
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
        open={canRemoveExtra}
        onOpenChange={(open) => {
          if (!open) setRemoveExtra(null)
        }}
        title={t('operations:purchasing.extras.deleteTitle')}
        desc={t('operations:purchasing.extras.deleteDescription')}
        confirmText={t('operations:common.delete')}
        destructive
        disabled={!canRemoveExtra}
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (removeExtra === null || !editable) return
          remove.mutate({
            extra: removeExtra,
            scope: organizationCacheScope(),
            ui: captureBranchScope(selectedBranch?.branch.uuid ?? null),
          })
        }}
      />
    </section>
  )
}
