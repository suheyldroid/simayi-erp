import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { currencyApi, errorMessage } from './api'
import { CurrencySelect } from './components/currency-select'

/**
 * System currency setup. This is a singleton setting, not a resource
 * collection: the currency list itself is server-owned and read-only, and the
 * chosen currency is written once, then governs every new price everywhere.
 */
export function CurrencySettings() {
  const client = useQueryClient()
  const [choice, setChoice] = useState<string | null>(null)
  const preference = useQuery({
    queryKey: ['system-preference'],
    queryFn: () => currencyApi.preference(),
  })
  const saved = preference.data?.defaultCurrencyCode ?? null
  const save = useMutation({
    mutationFn: (code: string) => currencyApi.savePreference(code),
    onSuccess: async (next) => {
      client.setQueryData(['system-preference'], next)
      toast.success('System currency saved')
      await client.invalidateQueries({ queryKey: ['system-preference'] })
    },
    onError: (error) => {
      toast.error(errorMessage(error))
      // A conflict means another request configured it first; show the stored
      // code instead of leaving the setup form on screen.
      void preference.refetch()
    },
  })
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Currency</h2>
        <p className='text-muted-foreground'>
          One system currency for every organization. It is chosen once and then
          fixed: new purchase line prices, recipe prices, and financial amounts
          are recorded in it.
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
        {preference.isSuccess && saved !== null && (
          <>
            <p className='text-sm'>
              System currency: <span className='font-medium'>{saved}</span>
            </p>
            <p className='text-sm text-muted-foreground'>
              This is a permanent choice. It cannot be cleared, switched, or
              replaced here, and existing amounts are never converted or
              relabelled.
            </p>
          </>
        )}
        {preference.isSuccess && saved === null && (
          <>
            <p className='text-sm'>
              System currency:{' '}
              <span className='font-medium'>Not configured</span>
            </p>
            <CurrencySelect
              value={choice}
              allowClear={false}
              disabled={save.isPending}
              onChange={setChoice}
            />
            {save.error != null && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(save.error)}
              </p>
            )}
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                type='button'
                disabled={choice === null || save.isPending}
                onClick={() => {
                  if (choice === null) return
                  save.mutate(choice)
                }}
              >
                Save system currency
              </Button>
            </div>
            <p className='text-sm text-muted-foreground'>
              After it is saved the system currency is read-only. Amounts are
              stored as exact decimal strings and are never converted, rounded,
              or summed across currencies.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
