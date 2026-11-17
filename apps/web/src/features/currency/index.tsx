import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
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
      toast.success(t('catalog:currency.savedToast'))
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
        <h2 className='text-2xl font-bold'>{t('catalog:currency.title')}</h2>
        <p className='text-muted-foreground'>
          {t('catalog:currency.description')}
        </p>
      </div>
      <div className='space-y-4 rounded-md border border-border p-4'>
        {preference.isPending && (
          <p role='status'>{t('catalog:currency.loading')}</p>
        )}
        {preference.isError && (
          <p role='alert'>
            {errorMessage(preference.error)}{' '}
            <Button variant='outline' onClick={() => void preference.refetch()}>
              {t('catalog:common.retry')}
            </Button>
          </p>
        )}
        {preference.isSuccess && saved !== null && (
          <>
            <p className='text-sm'>
              {t('catalog:currency.savedLabel')}{' '}
              <span className='font-medium'>{saved}</span>
            </p>
            <p className='text-sm text-muted-foreground'>
              {t('catalog:currency.permanentNote')}
            </p>
          </>
        )}
        {preference.isSuccess && saved === null && (
          <>
            <p className='text-sm'>
              {t('catalog:currency.savedLabel')}{' '}
              <span className='font-medium'>
                {t('catalog:currency.notConfigured')}
              </span>
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
                {t('catalog:currency.saveButton')}
              </Button>
            </div>
            <p className='text-sm text-muted-foreground'>
              {t('catalog:currency.savedReadOnly')}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
