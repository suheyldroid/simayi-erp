import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FieldInput } from '@/features/common/components/field-input'
import { FlagInput } from './flag-input'
import { errorMessage } from '../api'
import { supplyApi } from '../supply-api'
import {
  SupplyModel,
  type PriceBreak,
  type SupplierInput,
  type SupplierPart,
} from '../supply-model'

function PriceBreaks({
  supplierPart,
  canAdd,
  canDelete,
}: {
  supplierPart: SupplierPart
  canAdd: boolean
  canDelete: boolean
}) {
  const client = useQueryClient()
  const prices = useQuery({
    queryKey: ['company', 'prices', supplierPart.id],
    queryFn: () => supplyApi.prices(supplierPart.id),
  })
  const [remove, setRemove] = useState<PriceBreak | null>(null)
  const save = useMutation({
    mutationFn: (body: { quantity: string; price?: string | null; priceCurrency?: string }) =>
      supplyApi.savePrice(supplierPart.id, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['company', 'prices', supplierPart.id] })
      await client.invalidateQueries({ queryKey: ['company', 'supplier-parts'] })
      toast.success('Price break saved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (row: PriceBreak) => supplyApi.removePrice(supplierPart.id, row.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['company', 'prices', supplierPart.id] })
      await client.invalidateQueries({ queryKey: ['company', 'supplier-parts'] })
      setRemove(null)
      toast.success('Price break deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3'>
      <h4 className='text-sm font-medium'>
        Prices for {supplierPart.sku}
      </h4>
      {canAdd && (
        <form
          className='grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto]'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const price = String(form.get('price') ?? '').trim()
            const currency = String(form.get('priceCurrency') ?? '').trim()
            try {
              save.mutate(
                SupplyModel.priceInput.parse({
                  quantity: String(form.get('quantity') ?? ''),
                  ...(price === '' ? { price: null } : { price }),
                  ...(currency === '' ? {} : { priceCurrency: currency }),
                })
              )
              event.currentTarget.reset()
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          <FieldInput
            field={{ name: 'quantity', label: 'Quantity', required: true }}
          />
          <FieldInput field={{ name: 'price', label: 'Price' }} />
          <FieldInput
            field={{ name: 'priceCurrency', label: 'Currency', maxLength: 3 }}
          />
          <Button className='self-end' type='submit' disabled={save.isPending}>
            Add
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
                  {row.price == null ? '—' : `${row.price} ${row.priceCurrency}`}
                </TableCell>
                <TableCell>
                  {canDelete && (
                    <Button type='button' variant='outline' onClick={() => setRemove(row)}>
                      Remove
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
        desc='This quantity price will be removed from the supplier part.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (remove) deletion.mutate(remove)
        }}
      />
    </div>
  )
}

export function SupplierPartsPanel({
  partId,
  supplierId,
  canAdd,
  canChange,
  canDelete,
}: {
  partId?: number
  supplierId?: number
  canAdd: boolean
  canChange: boolean
  canDelete: boolean
}) {
  const client = useQueryClient()
  const rows = useQuery({
    queryKey: ['company', 'supplier-parts', partId, supplierId],
    queryFn: () => supplyApi.supplierParts({ partId, supplierId }),
  })
  const [draft, setDraft] = useState<SupplierPart | null | undefined>(undefined)
  const [selected, setSelected] = useState<SupplierPart | null>(null)
  const [remove, setRemove] = useState<SupplierPart | null>(null)
  const save = useMutation({
    mutationFn: (input: { id?: number; body: SupplierInput }) =>
      supplyApi.saveSupplierPart(input.body, input.id),
    onSuccess: async (row, variables) => {
      await client.invalidateQueries({ queryKey: ['company', 'supplier-parts'] })
      setSelected(row)
      setDraft(undefined)
      toast.success(variables.id ? 'Supplier part updated' : 'Supplier part created')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: supplyApi.removeSupplierPart,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['company', 'supplier-parts'] })
      if (selected?.id === remove?.id) setSelected(null)
      setRemove(null)
      toast.success('Supplier part deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-medium'>Supplier parts</h3>
        {canAdd && (
          <Button type='button' variant='outline' onClick={() => setDraft(null)}>
            Add SKU
          </Button>
        )}
      </div>
      <p className='text-muted-foreground text-sm'>
        Pack quantity is the number of internal units in one supplier pack.
        Marking a supplier part primary clears that flag on the part’s other
        supplier parts. Deleting a supplier part also deletes its price breaks.
      </p>
      {rows.isPending && <p role='status'>Loading supplier parts…</p>}
      {rows.isError && <p role='alert'>{errorMessage(rows.error)}</p>}
      {rows.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>{partId == null ? 'Part' : 'Supplier'}</TableHead>
              <TableHead>Pack</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((row) => (
              <TableRow
                key={row.id}
                data-state={selected?.id === row.id ? 'selected' : undefined}
                onClick={() => setSelected(row)}
              >
                <TableCell>{row.sku}</TableCell>
                <TableCell>
                  {partId == null ? row.part.name : row.supplier.name}
                </TableCell>
                <TableCell>{row.packQuantity}</TableCell>
                <TableCell>{row.baseCost}</TableCell>
                <TableCell>
                  {row.active ? 'Active' : 'Inactive'}
                  {row.primary ? ' · primary' : ''}
                  {row.priceCount ? ` · ${row.priceCount} prices` : ''}
                </TableCell>
                <TableCell className='space-x-2'>
                  {canChange && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={(event) => {
                        event.stopPropagation()
                        setDraft(row)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={(event) => {
                        event.stopPropagation()
                        setRemove(row)
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>No supplier parts yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      {selected && (
        <PriceBreaks
          supplierPart={selected}
          canAdd={canAdd}
          canDelete={canDelete}
        />
      )}
      <Dialog
        open={draft !== undefined}
        onOpenChange={(open) => {
          if (!open) setDraft(undefined)
        }}
      >
        <DialogContent className='max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {draft ? 'Edit supplier part' : 'New supplier part'}
            </DialogTitle>
            <DialogDescription>
              The company must be a supplier and the internal part must be
              purchaseable. SKU is unique for that supplier and part.
            </DialogDescription>
          </DialogHeader>
          {draft !== undefined && (
            <form
              key={draft?.id ?? 'new'}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                try {
                  save.mutate({
                    id: draft?.id,
                    body: SupplyModel.supplierInput.parse({
                      partId: partId ?? Number(form.get('partId')),
                      supplierId: supplierId ?? Number(form.get('supplierId')),
                      sku: String(form.get('sku') ?? ''),
                      manufacturerPartId: String(form.get('manufacturerPartId') ?? ''),
                      description: String(form.get('description') ?? ''),
                      note: String(form.get('note') ?? ''),
                      link: String(form.get('link') ?? ''),
                      packaging: String(form.get('packaging') ?? ''),
                      packQuantity: String(form.get('packQuantity') ?? '1'),
                      baseCost: String(form.get('baseCost') ?? '0'),
                      available: String(form.get('available') ?? '0'),
                      multiple: Number(form.get('multiple') ?? 1),
                      active: form.has('active'),
                      primary: form.has('primary'),
                    }),
                  })
                } catch (error) {
                  toast.error(errorMessage(error))
                }
              }}
            >
              {partId == null && (
                <FieldInput
                  field={{ name: 'partId', label: 'Part ID', type: 'number', required: true, min: 1 }}
                  value={draft ? String(draft.partId) : ''}
                />
              )}
              {supplierId == null && (
                <FieldInput
                  field={{ name: 'supplierId', label: 'Supplier ID', type: 'number', required: true, min: 1 }}
                  value={draft ? String(draft.supplierId) : ''}
                />
              )}
              <FieldInput
                field={{ name: 'sku', label: 'SKU', required: true, maxLength: 100 }}
                value={draft?.sku ?? ''}
              />
              <FieldInput
                field={{ name: 'manufacturerPartId', label: 'Manufacturer part ID', type: 'number', min: 1 }}
                value={
                  draft?.manufacturerPartId == null
                    ? ''
                    : String(draft.manufacturerPartId)
                }
              />
              <div className='grid gap-4 sm:grid-cols-2'>
                <FieldInput
                  field={{ name: 'packQuantity', label: 'Pack quantity', required: true }}
                  value={draft?.packQuantity || '1'}
                />
                <FieldInput
                  field={{ name: 'multiple', label: 'Order multiple', type: 'number', min: 1 }}
                  value={draft ? String(draft.multiple) : '1'}
                />
                <FieldInput
                  field={{ name: 'baseCost', label: 'Base cost' }}
                  value={draft?.baseCost ?? '0'}
                />
                <FieldInput
                  field={{ name: 'available', label: 'Available' }}
                  value={draft?.available ?? '0'}
                />
              </div>
              <FieldInput
                field={{ name: 'packaging', label: 'Packaging', maxLength: 50 }}
                value={draft?.packaging ?? ''}
              />
              <FieldInput
                field={{ name: 'description', label: 'Description', maxLength: 250 }}
                value={draft?.description ?? ''}
              />
              <FieldInput
                field={{ name: 'note', label: 'Note', maxLength: 100 }}
                value={draft?.note ?? ''}
              />
              <FieldInput
                field={{ name: 'link', label: 'Link', maxLength: 2000 }}
                value={draft?.link ?? ''}
              />
              <div className='flex gap-4'>
                <FlagInput name='active' label='Active' defaultChecked={draft?.active ?? true} />
                <FlagInput name='primary' label='Primary' defaultChecked={draft?.primary ?? false} />
              </div>
              <DialogFooter>
                <Button type='submit' disabled={save.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={remove != null}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title='Delete supplier part'
        desc='Price breaks for this SKU are deleted with it.'
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
