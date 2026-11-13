import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { currencyApi, errorMessage } from './api'
import { CurrencySelect } from './components/currency-select'

/**
 * System currency preference. This is a singleton setting, not a resource
 * collection: the currency list itself is server-owned and read-only, and the
 * default applies to new purchase orders in every organization.
 */
export function CurrencySettings() {
  const client = useQueryClient()
  const [choice, setChoice] = useState<string | null | undefined>(undefined)
  const preference = useQuery({
    queryKey: ['system-preference'],
    queryFn: () => currencyApi.preference(),
  })
  const catalog = useQuery({
    queryKey: ['currency', 'catalog'],
    queryFn: () => currencyApi.currencies(),
  })
  const saved = preference.data?.defaultCurrencyCode ?? null
  // `undefined` means untouched: the page follows the saved value. An explicit
  // null is the user clearing the default.
  const value = choice === undefined ? saved : choice
  const dirty = preference.isSuccess && value !== saved
  const save = useMutation({
    mutationFn: (code: string | null) => currencyApi.savePreference(code),
    onSuccess: async (next) => {
      client.setQueryData(['system-preference'], next)
      setChoice(undefined)
      toast.success('Default currency saved')
      await client.invalidateQueries({ queryKey: ['system-preference'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Currency</h2>
        <p className='text-muted-foreground'>
          System-wide default currency for new purchase orders in every
          organization. The catalog is fixed by the server; this page only
          selects a default.
        </p>
      </div>
      <div className='space-y-4 rounded-md border border-border p-4'>
        {preference.isPending && <p role='status'>Loading currency…</p>}
        {preference.isError && (
          <p role='alert'>
            {errorMessage(preference.error)}{' '}
            <Button variant='outline' onClick={() => void preference.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {preference.isSuccess && (
          <>
            <p className='text-sm'>
              Current default:{' '}
              <span className='font-medium'>
                {saved ?? 'No default currency'}
              </span>
            </p>
            <form
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                if (!dirty || save.isPending) return
                save.mutate(value)
              }}
            >
              <CurrencySelect
                value={value}
                disabled={save.isPending}
                onChange={setChoice}
              />
              {catalog.isPending && (
                <p role='status' className='text-sm text-muted-foreground'>
                  Loading currency catalog…
                </p>
              )}
              {catalog.isError && (
                <p role='alert'>
                  Could not load the currency catalog.{' '}
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => void catalog.refetch()}
                  >
                    Retry
                  </Button>
                </p>
              )}
              {catalog.isSuccess && catalog.data.items.length === 0 && (
                <p role='status' className='text-sm text-muted-foreground'>
                  The server returned no currencies. A default cannot be
                  selected until the catalog is available.
                </p>
              )}
              {save.error != null && (
                <p role='alert' className='text-sm text-destructive'>
                  {errorMessage(save.error)}
                </p>
              )}
              <div className='flex flex-wrap items-center gap-2'>
                <Button type='submit' disabled={!dirty || save.isPending}>
                  Save default
                </Button>
                {choice !== undefined && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={save.isPending}
                    onClick={() => setChoice(undefined)}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </form>
            <p className='text-sm text-muted-foreground'>
              A purchase order keeps the currency it was created with. Amounts
              are stored as exact decimal strings and are never converted,
              rounded, or summed across currencies. When no default is set, an
              order must explicitly choose one.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
