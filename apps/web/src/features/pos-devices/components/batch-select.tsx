import { useId, useState } from 'react'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { branchCacheScope } from '@/lib/branch-scope'
import { t } from '@/lib/i18n'
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
import { salesBatchesApi } from '@/features/sales/batches/api'
import { errorMessage } from '../api'
import type { ZReportBatch } from '../model'

/**
 * Optional single sales batch selection over the real paginated batch list of
 * the selected branch. Only processed batches (status 20) can be linked; the
 * already linked row is kept visible even when it is not on the current page or
 * search result. A batch from another branch never appears here, and the API
 * rejects cross-branch attachments.
 */
export function BatchSelect({
  label,
  branchUuid,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  branchUuid: string
  value: ZReportBatch | null
  disabled?: boolean
  onChange: (next: ZReportBatch | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const options = useQuery({
    queryKey: [
      'sales',
      branchCacheScope(branchUuid),
      'batches',
      'select',
      page,
      search,
    ],
    queryFn: () => salesBatchesApi.list({ branchUuid, page, search }),
    enabled: open,
  })
  const limit = options.data?.limit ?? 20
  const total = options.data?.total ?? 0
  const processed = (options.data?.items ?? []).filter(
    (batch) => batch.status === 20
  )
  const rows: ZReportBatch[] =
    value !== null && !processed.some((batch) => batch.uuid === value.uuid)
      ? [value, ...processed]
      : processed
  const hasNext = (page + 1) * limit < total

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
              className={cn(
                'relative w-full min-w-0 justify-start ps-3',
                value !== null ? 'pe-16' : 'pe-9'
              )}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-start',
                  value === null && 'text-muted-foreground'
                )}
              >
                {value === null
                  ? t('operations:zReports.batchSelect.none')
                  : value.reference || value.uuid}
              </span>
              <span
                aria-hidden='true'
                className={cn(
                  'pointer-events-none absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center opacity-50',
                  value !== null ? 'end-10' : 'end-3'
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
                aria-label={t('operations:zReports.batchSelect.searchLabel')}
                placeholder={t(
                  'operations:zReports.batchSelect.searchPlaceholder'
                )}
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
                    {t('operations:zReports.batchSelect.loading')}
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
                      {t('operations:common.retry')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {t('operations:zReports.batchSelect.empty')}
                    </CommandEmpty>
                    <CommandGroup>
                      {rows.map((batch) => (
                        <CommandItem
                          key={batch.uuid}
                          value={batch.uuid}
                          disabled={disabled}
                          onSelect={() => {
                            onChange(batch)
                            setOpen(false)
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              'size-4',
                              value?.uuid === batch.uuid
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className='min-w-0 flex-1 truncate'>
                            {batch.reference || batch.uuid}
                          </span>
                          <span className='shrink-0 text-xs text-muted-foreground'>
                            {batch.businessDate}
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
                  {t('operations:zReports.batchSelect.previous')}
                </Button>
                <span className='text-xs text-muted-foreground'>
                  {total === 0
                    ? t('operations:zReports.batchSelect.noneFound')
                    : t('operations:zReports.batchSelect.range', {
                        from: page * limit + 1,
                        to: Math.min((page + 1) * limit, total),
                        total,
                      })}
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={!hasNext || options.isFetching || disabled}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('operations:zReports.batchSelect.next')}
                </Button>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
        {value !== null && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label={t('operations:zReports.batchSelect.clear')}
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
      <p className='text-xs text-muted-foreground'>
        {t('operations:zReports.batchSelect.hint')}
      </p>
    </div>
  )
}
