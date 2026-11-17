import { useId, useState } from 'react'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
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
import { errorMessage, unitApi } from '../api'

const PAGE_SIZE = 20

export type UnitOption = {
  uuid: string
  name: string
  code: string
  active: boolean
}

const unitText = (unit: Pick<UnitOption, 'name' | 'code'>) =>
  `${unit.name} · ${unit.code}`

/**
 * Searchable, server-paginated unit picker. Only active units can be newly
 * selected; an assigned inactive unit is loaded through its UUID so it stays
 * visible and explicit.
 */
export function UnitSelect({
  value,
  fallbackUuid = null,
  disabled = false,
  label = t('catalog:units.select.label'),
  onChange,
}: {
  value: UnitOption | null
  /** Loaded record UUID to label only when the captured unit is missing. */
  fallbackUuid?: string | null
  disabled?: boolean
  label?: string
  onChange: (next: UnitOption | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const options = useQuery({
    queryKey: ['unit', 'options', page, search],
    queryFn: () =>
      unitApi.units({ page, search, active: true, limit: PAGE_SIZE }),
    enabled: open,
  })
  const fallback = useQuery({
    queryKey: ['unit', 'detail', fallbackUuid],
    queryFn: () => {
      if (fallbackUuid == null) throw new Error(t('catalog:units.uuidRequired'))
      return unitApi.unit(fallbackUuid)
    },
    enabled: fallbackUuid != null && value == null,
  })
  const fallbackOption: UnitOption | null =
    fallback.data == null
      ? null
      : {
          uuid: fallback.data.uuid,
          name: fallback.data.name,
          code: fallback.data.code,
          active: fallback.data.active,
        }
  const selected = value ?? fallbackOption
  const total = options.data?.total ?? 0
  const hasNext = (page + 1) * PAGE_SIZE < total
  const units = options.data?.items ?? []
  const fallbackFailed = fallback.isError && value == null

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
              title={selected == null ? undefined : unitText(selected)}
              className='relative w-full min-w-0 justify-start ps-3 pe-9'
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-start',
                  selected == null && 'text-muted-foreground'
                )}
              >
                {selected == null
                  ? t('catalog:units.select.select')
                  : unitText(selected)}
              </span>
              {selected != null && !selected.active && (
                <span className='shrink-0 text-xs text-muted-foreground'>
                  {t('catalog:units.select.inactive')}
                </span>
              )}
              <span
                aria-hidden='true'
                className='pointer-events-none absolute end-3 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center opacity-50'
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
                aria-label={t('catalog:units.select.searchLabel')}
                placeholder={t('catalog:units.select.searchPlaceholder')}
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
                    {t('catalog:units.select.loading')}
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
                      {t('catalog:units.select.empty')}
                    </CommandEmpty>
                    <CommandGroup>
                      {units.map((unit) => (
                        <CommandItem
                          key={unit.uuid}
                          value={unit.uuid}
                          disabled={disabled}
                          onSelect={() => {
                            onChange({
                              uuid: unit.uuid,
                              name: unit.name,
                              code: unit.code,
                              active: unit.active,
                            })
                            setOpen(false)
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              'size-4',
                              selected?.uuid === unit.uuid
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className='min-w-0 flex-1 truncate'>
                            {unit.name}
                          </span>
                          <span className='shrink-0 text-xs text-muted-foreground'>
                            {unit.code}
                          </span>
                        </CommandItem>
                      ))}
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
                    ? t('catalog:units.select.none')
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
      </div>
      {fallbackFailed && (
        <p
          role='alert'
          className='flex items-center gap-2 text-xs text-destructive'
        >
          {t('catalog:units.select.loadError')}
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={disabled}
            onClick={() => void fallback.refetch()}
          >
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
    </div>
  )
}
