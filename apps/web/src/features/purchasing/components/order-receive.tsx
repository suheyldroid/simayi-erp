import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { subtractDecimalStrings } from '@/lib/decimal-string'
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
import { FieldInput } from '@/components/field-input'
import { errorMessage, purchasingApi } from '../api'
import {
  PurchasingModel,
  type PurchaseLine,
  type PurchaseOrder,
} from '../model'

export function OrderReceive({
  order,
  lines,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
}) {
  const client = useQueryClient()
  const [receiving, setReceiving] = useState(false)
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const line =
    lines.find((item) => item.uuid === selectedUuid) ?? lines[0] ?? null
  const save = useMutation({
    mutationFn: (input: {
      body: { lineUuid: string; quantity: string }
      scope: string
    }) =>
      purchasingApi.receive(order.uuid, {
        version: order.version,
        items: [input.body],
      }),
    onSuccess: async (result, input) => {
      await client.invalidateQueries({
        queryKey: ['purchasing', input.scope],
      })
      await invalidateItemStockCaches(client, input.scope)
      setReceiving(false)
      toast.success(
        result.items.length === 1
          ? 'Item stock received'
          : `${result.items.length} items received`
      )
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  if (line == null) return null
  return (
    <section className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-xl font-semibold'>Receive</h2>
        <Button
          type='button'
          variant='outline'
          onClick={() => {
            setValidationError(null)
            setReceiving(true)
          }}
        >
          Receive stock
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        Receive stock against the outstanding quantity of one order line.
      </p>
      {receiving && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && !save.isPending) setReceiving(false)
          }}
        >
          <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
            <SheetHeader>
              <SheetTitle>Receive stock</SheetTitle>
              <SheetDescription>
                Stock is received for this purchase order version, so a stale
                order cannot be received.
              </SheetDescription>
            </SheetHeader>
            <form
              className='flex min-h-0 flex-1 flex-col'
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                try {
                  const parsed = PurchasingModel.receiveInput.parse({
                    version: order.version,
                    items: [
                      {
                        lineUuid: line.uuid,
                        quantity: String(form.get('quantity') ?? ''),
                      },
                    ],
                  })
                  const item = parsed.items[0]
                  if (!item) return
                  setValidationError(null)
                  save.mutate({
                    body: item,
                    scope: organizationCacheScope(),
                  })
                } catch (caught) {
                  setValidationError(errorMessage(caught))
                }
              }}
            >
              <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
                <fieldset disabled={save.isPending} className='space-y-4'>
                  <label className='block space-y-2 text-sm'>
                    <span>Line</span>
                    <select
                      className='w-full rounded-md border border-input bg-background px-3 py-2'
                      value={line.uuid}
                      onChange={(event) => setSelectedUuid(event.target.value)}
                    >
                      {lines.map((item) => (
                        <option key={item.uuid} value={item.uuid}>
                          {item.item
                            ? `${item.item.name}${item.item.ipn ? ` · ${item.item.ipn}` : ''}`
                            : item.reference || 'Line'}{' '}
                          ·{' '}
                          {subtractDecimalStrings(item.quantity, item.received)}{' '}
                          {item.unitCode ?? 'Unknown unit'} outstanding
                        </option>
                      ))}
                    </select>
                  </label>
                  <FieldInput
                    field={{
                      name: 'quantity',
                      label: `Quantity to receive (${line.unitCode ?? 'unknown unit'})`,
                      required: true,
                    }}
                  />
                </fieldset>
                {(validationError != null || save.error != null) && (
                  <p role='alert' className='text-destructive'>
                    {validationError ?? errorMessage(save.error)}
                  </p>
                )}
              </div>
              <SheetFooter className='border-t'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setReceiving(false)}
                  disabled={save.isPending}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={save.isPending}>
                  Receive
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}
