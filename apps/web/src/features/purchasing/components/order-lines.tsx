import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isPositiveDecimal } from '@/lib/decimal-string'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
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
import { itemApi } from '@/features/items/api'
import { errorMessage, purchasingApi } from '../api'
import {
  PurchasingModel,
  type LineInput,
  type PurchaseLine,
  type PurchaseOrder,
} from '../model'

type ItemChoice = { uuid: string; name: string; ipn: string | null; units: string }

function PurchaseLineForm({
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
  onSubmit: (body: LineInput) => void
}) {
  const itemSearchId = useId()
  const [item, setItem] = useState<ItemChoice | null>(null)
  const [search, setSearch] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const items = useQuery({
    queryKey: ['item', 'items', 'purchasing', organizationCacheScope(), search],
    queryFn: () => itemApi.items({ page: 0, search, limit: 8 }),
    enabled: search.trim().length > 0,
  })
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
            An item and its ordered quantity in the item's stock unit. Prices
            use the order currency ({currencyCode ?? 'unknown currency'}). The
            order version is sent with the line so a stale order cannot be
            changed.
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
              <div className='space-y-2'>
                <Label htmlFor={itemSearchId}>Item</Label>
                <Input
                  id={itemSearchId}
                  aria-label='Search items by name or IPN'
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search items by name or IPN'
                  maxLength={150}
                />
                {item && (
                  <p className='text-sm'>
                    Selected: {item.name}
                    {item.ipn ? ` · ${item.ipn}` : ''} ·{' '}
                    {item.units || 'unit unresolved'}
                  </p>
                )}
                {search.trim() !== '' && items.isFetching && (
                  <p role='status'>Loading items…</p>
                )}
                {items.isError && (
                  <p role='alert'>{errorMessage(items.error)}</p>
                )}
                {search.trim() !== '' && items.data && (
                  <ul className='space-y-1'>
                    {items.data.items.map((entry) => (
                      <li key={entry.uuid}>
                        <Button
                          type='button'
                          variant='link'
                          className='h-auto p-0'
                          onClick={() => {
                            setItem({
                              uuid: entry.uuid,
                              name: entry.name,
                              ipn: entry.ipn,
                              units: entry.units,
                            })
                            setSearch('')
                          }}
                        >
                          {entry.name}
                          {entry.ipn ? ` · ${entry.ipn}` : ''}
                        </Button>
                      </li>
                    ))}
                    {items.data.items.length === 0 && (
                      <li className='text-sm text-muted-foreground'>
                        No items found.
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div className='space-y-2'>
                <FieldInput
                  field={{ name: 'quantity', label: 'Quantity', required: true }}
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
                  label: `Unit price (${currencyCode ?? 'unknown currency'})`,
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
  currencyCode,
  pending,
  error,
  editable,
  onRetry,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
  currencyCode: string | null
  pending: boolean
  error: unknown
  editable: boolean
  onRetry: () => void
}) {
  const client = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [removeLine, setRemoveLine] = useState<PurchaseLine | null>(null)
  const save = useMutation({
    mutationFn: (body: LineInput) => purchasingApi.addLine(order.uuid, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      setAdding(false)
      toast.success('Line added')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (line: PurchaseLine) =>
      purchasingApi.removeLine(order.uuid, line.uuid, order.version),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      setRemoveLine(null)
      toast.success('Line deleted')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const canRemoveLine =
    removeLine !== null && editable && !isPositiveDecimal(removeLine.received)
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Price</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.uuid}>
              <TableCell>
                {line.item
                  ? `${line.item.name}${line.item.ipn ? ` · ${line.item.ipn}` : ''}`
                  : '—'}
              </TableCell>
              <TableCell>{line.quantity}</TableCell>
              <TableCell>{line.received}</TableCell>
              <TableCell>{line.unitCode ?? 'Unknown unit'}</TableCell>
              <TableCell>
                {line.purchasePrice == null
                  ? '—'
                  : `${line.purchasePrice} ${currencyCode ?? 'Unknown currency'}`}
              </TableCell>
              <TableCell>
                {editable && !isPositiveDecimal(line.received) && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={remove.isPending}
                    onClick={() => setRemoveLine(line)}
                  >
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>No lines yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {editable && adding && (
        <PurchaseLineForm
          version={order.version}
          currencyCode={currencyCode}
          pending={save.isPending}
          error={save.error}
          onClose={() => setAdding(false)}
          onSubmit={(body) => save.mutate(body)}
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
          remove.mutate(removeLine)
        }}
      />
    </section>
  )
}
