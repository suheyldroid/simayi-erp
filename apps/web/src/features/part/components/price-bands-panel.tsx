import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldInput } from '@/features/common/components/field-input'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { errorMessage, partApi } from '../api'
import {
  PartModel,
  type Part,
  type PriceBreak,
  type PriceInput,
} from '../model'

const titles = {
  sell: 'Sell prices',
  internal: 'Internal prices',
} as const

export function PriceBandsPanel({
  part,
  kind,
  permissions,
}: {
  part: Part
  kind: 'sell' | 'internal'
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'part', 'add')
  const canChange = hasPermission(permissions, 'part', 'change')
  const canDelete = hasPermission(permissions, 'part', 'delete')
  const prices = useQuery({
    queryKey: ['part', 'prices', kind, part.id],
    queryFn: () => partApi.priceBreaks(kind, part.id),
  })
  const [editing, setEditing] = useState<PriceBreak | null>(null)
  const [remove, setRemove] = useState<PriceBreak | null>(null)
  const save = useMutation({
    mutationFn: (input: { id?: number; body: PriceInput }) =>
      partApi.savePriceBreak(kind, part.id, input.body, input.id),
    onSuccess: async (_row, variables) => {
      await client.invalidateQueries({
        queryKey: ['part', 'prices', kind, part.id],
      })
      setEditing(null)
      toast.success(variables.id ? 'Price break updated' : 'Price break added')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (id: number) => partApi.removePriceBreak(kind, part.id, id),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['part', 'prices', kind, part.id],
      })
      setRemove(null)
      toast.success('Price break deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const showForm = !part.locked && (editing ? canChange : canAdd)
  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-medium'>{titles[kind]}</h3>
        {canAdd && !part.locked && editing && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setEditing(null)}
          >
            New price
          </Button>
        )}
      </div>
      <p className='text-sm text-muted-foreground'>
        Quantity is unique for this part and must be at least 1. Leave currency
        blank to use the company default.
      </p>
      {part.locked && (
        <p className='text-sm text-muted-foreground'>
          Unlock the part before changing its price bands.
        </p>
      )}
      {showForm && (
        <form
          key={editing?.id ?? 'new'}
          className='grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto]'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const price = String(form.get('price') ?? '').trim()
            const currency = String(form.get('priceCurrency') ?? '')
              .trim()
              .toUpperCase()
            try {
              save.mutate({
                id: editing?.id,
                body: PartModel.priceInput.parse({
                  quantity: String(form.get('quantity') ?? ''),
                  ...(price === '' ? { price: null } : { price }),
                  ...(currency === '' ? {} : { priceCurrency: currency }),
                }),
              })
              if (!editing) event.currentTarget.reset()
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          <FieldInput
            field={{ name: 'quantity', label: 'Quantity', required: true }}
            value={editing?.quantity ?? ''}
          />
          <FieldInput
            field={{ name: 'price', label: 'Price' }}
            value={editing?.price ?? ''}
          />
          <FieldInput
            field={{ name: 'priceCurrency', label: 'Currency', maxLength: 3 }}
            value={editing?.priceCurrency ?? ''}
          />
          <Button className='self-end' type='submit' disabled={save.isPending}>
            {editing ? 'Save' : 'Add'}
          </Button>
        </form>
      )}
      {prices.isPending && <p role='status'>Loading prices…</p>}
      {prices.isError && <p role='alert'>{errorMessage(prices.error)}</p>}
      {prices.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>
                  {row.price == null
                    ? '—'
                    : `${row.price} ${row.priceCurrency}`}
                </TableCell>
                <TableCell className='space-x-2'>
                  {canChange && !part.locked && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setEditing(row)}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && !part.locked && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setRemove(row)}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {prices.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>No price breaks yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={remove != null}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title='Delete price break'
        desc='This quantity price will be removed from the part.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (remove) deletion.mutate(remove.id)
        }}
      />
    </div>
  )
}
