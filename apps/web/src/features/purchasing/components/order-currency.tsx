import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { CurrencySelect } from '@/features/currency/components/currency-select'
import { errorMessage, purchasingApi } from '../api'
import { PurchasingModel, type PurchaseOrder } from '../model'

/**
 * Assigns or changes the order currency. A known currency may only change
 * while the order has no item lines or extra lines; a legacy null code may be
 * assigned explicitly. The parent passes the server-derived lock state and
 * reason.
 */
export function OrderCurrencyAction({
  order,
  locked,
  lockReason,
}: {
  order: PurchaseOrder
  locked: boolean
  lockReason: string
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<string | null>(order.currencyCode)
  const [validationError, setValidationError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (currencyCode: string) =>
      purchasingApi.updateOrder(
        order.uuid,
        PurchasingModel.orderUpdateInput.parse({
          version: order.version,
          currencyCode,
        })
      ),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['purchasing', organizationCacheScope()],
      })
      setOpen(false)
      toast.success('Order currency updated')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const assigning = order.currencyCode == null
  return (
    <div className='space-y-1'>
      <Button
        type='button'
        variant='outline'
        disabled={locked || save.isPending}
        onClick={() => {
          setChoice(order.currencyCode)
          setValidationError(null)
          save.reset()
          setOpen(true)
        }}
      >
        {assigning ? 'Assign currency' : 'Change currency'}
      </Button>
      {locked && (
        <p className='text-xs text-muted-foreground'>{lockReason}</p>
      )}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next && !save.isPending) setOpen(false)
        }}
      >
        <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
          <SheetHeader>
            <SheetTitle>
              {assigning ? 'Assign order currency' : 'Change order currency'}
            </SheetTitle>
            <SheetDescription>
              One currency applies to every line and extra price on this order.
              Amounts are stored as exact decimals and are never converted.
            </SheetDescription>
          </SheetHeader>
          <form
            className='flex min-h-0 flex-1 flex-col'
            onSubmit={(event) => {
              event.preventDefault()
              if (save.isPending) return
              if (choice == null) {
                setValidationError('Choose a currency for this order.')
                return
              }
              setValidationError(null)
              save.mutate(choice)
            }}
          >
            <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
              <CurrencySelect
                value={choice}
                disabled={save.isPending}
                allowClear={false}
                onChange={setChoice}
              />
              <p className='text-xs text-muted-foreground'>
                A known currency cannot change once the order has item lines or
                extra lines. A legacy order without a currency can be assigned
                one while it stays open.
              </p>
              {validationError != null && (
                <p role='alert' className='text-sm text-destructive'>
                  {validationError}
                </p>
              )}
              {save.error != null && (
                <p role='alert' className='text-sm text-destructive'>
                  {errorMessage(save.error)}
                </p>
              )}
            </div>
            <SheetFooter className='border-t border-border'>
              <Button
                type='button'
                variant='outline'
                disabled={save.isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={save.isPending}>
                Save currency
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
