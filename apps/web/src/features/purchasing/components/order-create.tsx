import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { FieldInput } from '@/components/field-input'
import { supplierApi } from '@/features/supplier/api'
import type { Supplier } from '@/features/supplier/model'
import { errorMessage } from '../api'
import { PurchasingModel, type OrderInput } from '../model'

/** Actual supplier identity subset used when the create form has no picker. */
export type PurchaseOrderSupplier = Pick<Supplier, 'uuid' | 'name' | 'contact'>

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

export function PurchaseOrderForm({
  pending,
  error,
  fixedSupplier,
  onClose,
  onSubmit,
}: {
  pending: boolean
  error: unknown
  /** When set, the order is bound to this supplier and no picker is shown. */
  fixedSupplier?: PurchaseOrderSupplier
  onClose: () => void
  onSubmit: (body: OrderInput) => void
}) {
  const supplierSearchId = useId()
  const targetDateId = useId()
  const [supplier, setSupplier] = useState<PurchaseOrderSupplier | null>(null)
  const [search, setSearch] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const chosenSupplier = fixedSupplier ?? supplier
  const suppliers = useQuery({
    queryKey: [
      'supplier',
      organizationCacheScope(),
      'list',
      'purchase-order-picker',
      search,
    ],
    queryFn: () => supplierApi.list(0, search),
    enabled: fixedSupplier === undefined,
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
          <SheetTitle>Create purchase order</SheetTitle>
          <SheetDescription>
            A purchase order for one supplier. Item lines, extras, and receipts
            are added from the order.
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (!chosenSupplier) {
              setValidationError('Choose a supplier')
              return
            }
            const form = new FormData(event.currentTarget)
            const reference = text(form, 'reference').trim()
            const description = text(form, 'description').trim()
            const supplierReference = text(form, 'supplierReference').trim()
            const targetDate = text(form, 'targetDate').trim()
            try {
              const body = PurchasingModel.orderInput.parse({
                supplierUuid: chosenSupplier.uuid,
                ...(reference === '' ? {} : { reference }),
                ...(description === '' ? {} : { description }),
                ...(supplierReference === '' ? {} : { supplierReference }),
                ...(targetDate === '' ? {} : { targetDate }),
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
              {fixedSupplier ? (
                <div className='space-y-2'>
                  <p className='text-sm font-medium'>Supplier</p>
                  <p className='text-sm'>
                    {fixedSupplier.name}
                    {fixedSupplier.contact ? ` · ${fixedSupplier.contact}` : ''}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    The order is created for this supplier from its detail page.
                  </p>
                </div>
              ) : (
                <div className='space-y-2'>
                  <Label htmlFor={supplierSearchId}>Supplier</Label>
                  <Input
                    id={supplierSearchId}
                    aria-label='Search suppliers'
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder='Search suppliers'
                    maxLength={100}
                  />
                  {supplier && (
                    <p className='text-sm'>
                      Selected: {supplier.name}
                      {supplier.contact ? ` · ${supplier.contact}` : ''}
                    </p>
                  )}
                  {suppliers.isPending && (
                    <p role='status'>Loading suppliers…</p>
                  )}
                  {suppliers.isError && (
                    <p role='alert'>{errorMessage(suppliers.error)}</p>
                  )}
                  {suppliers.data && (
                    <ul className='space-y-1'>
                      {suppliers.data.items.slice(0, 8).map((entry) => (
                        <li key={entry.uuid}>
                          <Button
                            type='button'
                            variant='link'
                            className='h-auto p-0'
                            onClick={() => {
                              setSupplier({
                                uuid: entry.uuid,
                                name: entry.name,
                                contact: entry.contact,
                              })
                              setSearch('')
                            }}
                          >
                            {entry.name}
                            {entry.contact ? ` · ${entry.contact}` : ''}
                          </Button>
                        </li>
                      ))}
                      {suppliers.data.items.length === 0 && (
                        <li className='text-sm text-muted-foreground'>
                          No suppliers found.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              <FieldInput
                field={{ name: 'reference', label: 'Reference', maxLength: 64 }}
              />
              <FieldInput
                field={{
                  name: 'description',
                  label: 'Description',
                  maxLength: 250,
                  type: 'textarea',
                }}
              />
              <FieldInput
                field={{
                  name: 'supplierReference',
                  label: 'Supplier reference',
                  maxLength: 64,
                }}
              />
              <div className='space-y-2'>
                <Label htmlFor={targetDateId}>Target date</Label>
                <Input id={targetDateId} name='targetDate' type='date' />
              </div>
              <p className='text-sm text-muted-foreground'>
                The order reference is generated by the server when left blank.
              </p>
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
              Create order
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
