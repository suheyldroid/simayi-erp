import { useId, useState } from 'react'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { locale, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { currencyApi, errorMessage } from '../api'

const currencyDisplayNames = new Intl.DisplayNames(locale, {
  type: 'currency',
})

/** Localized display name for a code; the API name is the fallback. */
const currencyName = (currency: { code: string; name: string }) => {
  const localized = currencyDisplayNames.of(currency.code)
  // An unknown code comes back unchanged, which is not a display name.
  return localized === undefined || localized === currency.code
    ? currency.name
    : localized
}

/**
 * Currency picker over the server-owned currency catalog. No currency list is
 * hard-coded here: options and fraction digits come from the API; names are
 * localized for display by code, with the API name as fallback.
 */
export function CurrencySelect({
  value,
  label = t('catalog:currency.select.label'),
  disabled = false,
  allowClear = true,
  onChange,
}: {
  value: string | null
  label?: string
  disabled?: boolean
  allowClear?: boolean
  onChange: (code: string | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const catalog = useQuery({
    queryKey: ['currency', 'catalog'],
    queryFn: () => currencyApi.currencies(),
  })
  const query = search.trim().toLocaleLowerCase(locale)
  const items = (catalog.data?.items ?? []).filter(
    (currency) =>
      query === '' ||
      currency.code.toLowerCase().includes(query) ||
      currencyName(currency).toLocaleLowerCase(locale).includes(query)
  )
  const selected =
    catalog.data?.items.find((currency) => currency.code === value) ?? null
  return (
    <div className='min-w-0 space-y-2'>
      <Label htmlFor={triggerId}>{label}</Label>
      <div className='relative min-w-0'>
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (disabled) return
            if (next) setSearch('')
            setOpen(next)
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id={triggerId}
              type='button'
              variant='outline'
              role='combobox'
              disabled={disabled}
              title={
                selected == null
                  ? undefined
                  : `${selected.code} · ${currencyName(selected)}`
              }
              className={cn(
                'relative w-full min-w-0 justify-start ps-3',
                value != null && allowClear ? 'pe-16' : 'pe-9'
              )}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-start',
                  value == null && 'text-muted-foreground'
                )}
              >
                {selected == null
                  ? (value ?? t('catalog:currency.select.select'))
                  : `${selected.code} · ${currencyName(selected)}`}
              </span>
              <span
                aria-hidden='true'
                className={cn(
                  'pointer-events-none absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center opacity-50',
                  value != null && allowClear ? 'end-10' : 'end-3'
                )}
              >
                <CaretSortIcon className='size-4' />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align='start'
            className='w-(--radix-popover-trigger-width) p-0'
          >
            <Command shouldFilter={false} loop>
              <CommandInput
                aria-label={t('catalog:currency.select.searchLabel')}
                placeholder={t('catalog:currency.select.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                maxLength={60}
                disabled={disabled}
              />
              <CommandList>
                {catalog.isLoading ? (
                  <p
                    role='status'
                    className='p-3 text-sm text-muted-foreground'
                  >
                    {t('catalog:currency.select.loading')}
                  </p>
                ) : catalog.isError ? (
                  <div
                    role='alert'
                    className='space-y-2 p-3 text-sm text-destructive'
                  >
                    <p>{errorMessage(catalog.error)}</p>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={disabled}
                      onClick={() => void catalog.refetch()}
                    >
                      {t('catalog:common.retry')}
                    </Button>
                  </div>
                ) : catalog.data?.items.length === 0 ? (
                  <p className='p-3 text-sm text-muted-foreground'>
                    {t('catalog:currency.select.serverEmpty')}
                  </p>
                ) : (
                  <>
                    <CommandEmpty>
                      {t('catalog:currency.select.empty')}
                    </CommandEmpty>
                    <CommandGroup>
                      {items.map((currency) => (
                        <CommandItem
                          key={currency.code}
                          value={currency.code}
                          disabled={disabled}
                          onSelect={() => {
                            onChange(currency.code)
                            setOpen(false)
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              'size-4',
                              value === currency.code
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className='w-12 shrink-0 font-medium'>
                            {currency.code}
                          </span>
                          <span className='min-w-0 flex-1 truncate'>
                            {currencyName(currency)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {allowClear && value != null && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label={t('catalog:common.clearSelection', { label })}
            disabled={disabled}
            className='absolute end-1 top-1/2 size-7 -translate-y-1/2 rounded-sm text-muted-foreground'
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onChange(null)
            }}
          >
            <XIcon className='size-3.5' />
          </Button>
        )}
      </div>
    </div>
  )
}
