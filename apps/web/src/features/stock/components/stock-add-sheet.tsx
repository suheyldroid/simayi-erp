import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { errorMessage, itemApi } from '@/features/items/api'
import {
  ItemSelect,
  type ItemOption,
} from '@/features/items/components/item-select'
import { stockApi } from '../api'
import { StockPageModel } from '../model'

type AddRequest = {
  itemUuid: string
  version: number
  quantity: string
  notes?: string
  scope: string
}

/**
 * Root stock entry form. The picked item is only an option; one real item read
 * captures the snapshot (uuid, balance, version) used for the submit intent. A
 * failed submission retries with that same captured version instead of reading
 * a newer version that could double-add a committed adjustment.
 */
export function StockAddSheet({ onClose }: { onClose: () => void }) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<ItemOption | null>(null)
  const [submittedVersion, setSubmittedVersion] = useState<number | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const detail = useQuery({
    queryKey: [
      'item',
      'items',
      organizationCacheScope(),
      'detail',
      selected?.uuid,
    ],
    queryFn: () => itemApi.item(selected?.uuid as string),
    enabled: selected != null,
    refetchOnWindowFocus: false,
  })
  const addition = useMutation({
    mutationFn: (request: AddRequest) =>
      stockApi.adjust(request.itemUuid, 'add', {
        version: request.version,
        quantity: request.quantity,
        ...(request.notes === undefined ? {} : { notes: request.notes }),
      }),
    onSuccess: async (next, request) => {
      await invalidateItemStockCaches(client, request.scope)
      onClose()
      toast.success(`Stock added to ${next.name}`)
    },
  })
  const live = detail.data
  const unavailable =
    detail.isPending || detail.isFetching || detail.isError || live == null
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
          <SheetTitle>Add stock</SheetTitle>
          <SheetDescription>
            Add a quantity to a real item's current balance. The form reads the
            item once and reuses that captured version if the submission is
            retried.
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
                itemUuid: live.uuid,
                version,
                quantity: parsed.quantity,
                scope: organizationCacheScope(),
                ...(parsed.notes === undefined ? {} : { notes: parsed.notes }),
              })
            } catch (error) {
              setValidationError(errorMessage(error))
            }
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <ItemSelect
              label='Item'
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
              <p role='status'>Loading item…</p>
            )}
            {selected != null && detail.isError && (
              <p role='alert'>
                {errorMessage(detail.error)}{' '}
                <Button variant='outline' onClick={() => void detail.refetch()}>
                  Retry
                </Button>
              </p>
            )}
            {live && !detail.isError && (
              <p className='text-sm text-muted-foreground'>
                {live.name} · current stock {live.stock}
                {live.units ? ` ${live.units}` : ''} · version {live.version}
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
                  Reload item balance
                </Button>
              </div>
            )}
            <fieldset
              disabled={addition.isPending || live == null}
              className='space-y-3'
            >
              <FieldInput
                field={{
                  name: 'quantity',
                  label: 'Quantity to add',
                  required: true,
                  pattern: '\\d*[.,]\\d{1,5}|\\d+',
                }}
              />
              <FieldInput
                field={{ name: 'notes', label: 'Notes', maxLength: 512 }}
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
              Cancel
            </Button>
            <Button type='submit' disabled={addition.isPending || unavailable}>
              Add stock
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
