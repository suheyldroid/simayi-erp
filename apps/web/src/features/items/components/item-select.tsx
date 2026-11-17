import { useId, useState } from 'react'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { locale, t } from '@/lib/i18n'
import { organizationCacheScope } from '@/lib/tenant'
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
import { errorMessage, itemApi } from '../api'

const PAGE_SIZE = 20

export type ItemOption = {
  uuid: string
  name: string
  units: string
}

export function ItemSelect({
  label,
  value,
  excludeIds = [],
  activeOnly = true,
  disabled = false,
  invalid = false,
  describedBy,
  onChange,
}: {
  label: string
  value: ItemOption | null
  /** Items already chosen elsewhere; they stay visible but cannot be picked. */
  excludeIds?: readonly string[]
  /**
   * Restrict results to active items. Stock creation passes false because
   * inactive parts can still receive stock.
   */
  activeOnly?: boolean
  disabled?: boolean
  /** Marks the combobox invalid when a field-level message explains why. */
  invalid?: boolean
  describedBy?: string
  onChange: (next: ItemOption | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const options = useQuery({
    queryKey: [
      'item',
      'items',
      'select',
      organizationCacheScope(),
      activeOnly ? 'active' : 'all',
      page,
      search,
    ],
    queryFn: () =>
      itemApi.items({
        page,
        search,
        limit: PAGE_SIZE,
        active: activeOnly ? true : undefined,
      }),
    enabled: open,
  })
  const excluded = new Set(excludeIds)
  const items = options.data?.items ?? []
  const total = options.data?.total ?? 0
  const hasNext = (page + 1) * PAGE_SIZE < total

  return (
    <div className='min-w-0 space-y-2'>
      <Label htmlFor={triggerId}>{label}</Label>
      <div className='relative min-w-0'>
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (disabled) return
            if (next) setPage(0)
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
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              title={
                value == null
                  ? undefined
                  : value.units
                    ? t('catalog:items.select.titleWithUnits', {
                        name: value.name,
                        units: value.units,
                      })
                    : t('catalog:items.select.titleNoUnit', {
                        name: value.name,
                      })
              }
              className={cn(
                'relative w-full min-w-0 justify-start ps-3',
                value != null ? 'pe-16' : 'pe-9'
              )}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-start',
                  value == null && 'text-muted-foreground'
                )}
              >
                {value == null ? t('catalog:items.select.select') : value.name}
              </span>
              <span
                aria-hidden='true'
                className={cn(
                  'pointer-events-none absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center opacity-50',
                  value != null ? 'end-10' : 'end-3'
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
                aria-label={t('catalog:items.searchLabel')}
                placeholder={
                  activeOnly
                    ? t('catalog:items.select.searchActivePlaceholder')
                    : t('catalog:items.select.searchPlaceholder')
                }
                value={search}
                onValueChange={(next) => {
                  setSearch(next)
                  setPage(0)
                }}
                maxLength={100}
                disabled={disabled}
              />
              <CommandList>
                {options.isLoading ? (
                  <p
                    role='status'
                    className='p-3 text-sm text-muted-foreground'
                  >
                    {t('catalog:items.loading')}
                  </p>
                ) : options.isError ? (
                  <div
                    role='alert'
                    className='space-y-2 p-3 text-sm text-destructive'
                  >
                    <p>{errorMessage(options.error)}</p>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={disabled}
                      onClick={() => void options.refetch()}
                    >
                      {t('catalog:common.retry')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {activeOnly
                        ? t('catalog:items.select.emptyActive')
                        : t('catalog:items.select.empty')}
                    </CommandEmpty>
                    <CommandGroup>
                      {items.map((item) => {
                        const alreadyAdded = excluded.has(item.uuid)
                        return (
                          <CommandItem
                            key={item.uuid}
                            value={item.uuid}
                            disabled={disabled || alreadyAdded}
                            onSelect={() => {
                              onChange({
                                uuid: item.uuid,
                                name: item.name,
                                units: item.units,
                              })
                              setOpen(false)
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                'size-4',
                                value?.uuid === item.uuid
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <span className='min-w-0 flex-1 truncate'>
                              {item.name}
                            </span>
                            {item.units ? (
                              <span className='shrink-0 text-xs text-muted-foreground'>
                                {item.units}
                              </span>
                            ) : (
                              <span className='shrink-0 text-xs text-muted-foreground'>
                                {t('catalog:items.select.noUnit')}
                              </span>
                            )}
                            {alreadyAdded ? (
                              <span className='shrink-0 text-xs text-muted-foreground'>
                                {t('catalog:items.select.alreadyAdded')}
                              </span>
                            ) : null}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
              <div className='flex items-center justify-between gap-2 border-t border-border px-2 py-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={page === 0 || options.isFetching || disabled}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  {t('catalog:common.previous')}
                </Button>
                <span className='text-xs text-muted-foreground'>
                  {total === 0
                    ? t('catalog:items.select.noItems')
                    : t('catalog:common.range', {
                        from: (page * PAGE_SIZE + 1).toLocaleString(locale),
                        to: Math.min(
                          (page + 1) * PAGE_SIZE,
                          total
                        ).toLocaleString(locale),
                        total: total.toLocaleString(locale),
                      })}
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={!hasNext || options.isFetching || disabled}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('catalog:common.next')}
                </Button>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
        {value != null && (
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
