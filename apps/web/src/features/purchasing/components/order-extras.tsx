import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
  currencyCode,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  version: number
  currencyCode: string | null
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
          <SheetTitle>Add extra line</SheetTitle>
          <SheetDescription>
            Charges that are not item lines, such as shipping or fees. Prices
            use the order currency ({currencyCode ?? 'unknown currency'}). The
            order version is sent with the extra so a stale order cannot be
            changed.
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
                  label: 'Description',
                  maxLength: 250,
                }}
              />
              <FieldInput
                field={{ name: 'quantity', label: 'Quantity', required: true }}
              />
              <FieldInput
                field={{
                  name: 'price',
                  label: `Price (${currencyCode ?? 'unknown currency'})`,
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
              Add extra
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
  currencyCode,
  pending,
  error,
  editable,
  onRetry,
}: {
  order: PurchaseOrder
  extras: PurchaseExtra[]
  currencyCode: string | null
  pending: boolean
  error: unknown
  editable: boolean
  onRetry: () => void
}) {
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [removeExtra, setRemoveExtra] = useState<PurchaseExtra | null>(null)
  const save = useMutation({
    mutationFn: (body: ExtraInput) => purchasingApi.addExtra(order.uuid, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      setAdding(false)
      toast.success('Extra line added')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (extra: PurchaseExtra) =>
      purchasingApi.removeExtra(order.uuid, extra.uuid, order.version),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      setRemoveExtra(null)
      toast.success('Extra line deleted')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const canRemoveExtra = removeExtra !== null && editable
  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>Extra lines</h2>
        {editable && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setAdding(true)}
          >
            Add extra
          </Button>
        )}
      </div>
      {pending && <p role='status'>Loading extra lines…</p>}
      {error != null && (
        <p role='alert'>
          {errorMessage(error)}{' '}
          <Button variant='outline' onClick={onRetry}>
            Retry
          </Button>
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Price</TableHead>
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
                  : `${line.price} ${currencyCode ?? 'Unknown currency'}`}
              </TableCell>
              <TableCell>
                {editable && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={remove.isPending}
                    onClick={() => setRemoveExtra(line)}
                  >
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {extras.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>No extra lines yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {editable && adding && (
        <PurchaseExtraForm
          version={order.version}
          currencyCode={currencyCode}
          pending={save.isPending}
          error={save.error}
          onClose={() => setAdding(false)}
          onSubmit={(body) => save.mutate(body)}
        />
      )}
      <ConfirmDialog
        open={canRemoveExtra}
        onOpenChange={(open) => {
          if (!open) setRemoveExtra(null)
        }}
        title='Delete extra line'
        desc='The extra line is removed from this purchase order.'
        confirmText='Delete'
        destructive
        disabled={!canRemoveExtra}
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (removeExtra === null || !editable) return
          remove.mutate(removeExtra)
        }}
      />
    </section>
  )
}
