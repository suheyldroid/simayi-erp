import { useId, useState } from 'react'
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
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
import { errorMessage, supplierApi } from '../api'

const PAGE_SIZE = 20

export type SupplierOption = {
  uuid: string
  name: string
  contact: string
}

/**
 * Searchable supplier combobox over the paginated supplier endpoint. Selection
 * is a UUID and stays visible while the search text changes; nothing is ever
 * selected automatically.
 */
export function SupplierSelect({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: SupplierOption | null
  disabled?: boolean
  onChange: (next: SupplierOption | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const options = useQuery({
    queryKey: ['supplier', organizationCacheScope(), 'select', page, search],
    queryFn: () => supplierApi.list(page, search),
    enabled: open,
  })
  const suppliers = options.data?.items ?? []
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
              title={
                value == null
                  ? undefined
                  : value.contact
                    ? `${value.name} · ${value.contact}`
                    : value.name
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
                {value == null ? 'Select supplier' : value.name}
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
                aria-label='Search suppliers'
                placeholder='Search suppliers…'
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
                    Loading suppliers…
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
                      Retry
                    </Button>
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No suppliers found.</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.uuid}
                          value={supplier.uuid}
                          disabled={disabled}
                          onSelect={() => {
                            onChange({
                              uuid: supplier.uuid,
                              name: supplier.name,
                              contact: supplier.contact,
                            })
                            setOpen(false)
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              'size-4',
                              value?.uuid === supplier.uuid
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className='min-w-0 flex-1 truncate'>
                            {supplier.name}
                          </span>
                          {supplier.contact ? (
                            <span className='shrink-0 text-xs text-muted-foreground'>
                              {supplier.contact}
                            </span>
                          ) : null}
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
                  Previous
                </Button>
                <span className='text-xs text-muted-foreground'>
                  {total === 0
                    ? 'No suppliers'
                    : `${page * PAGE_SIZE + 1}–${Math.min(
                        (page + 1) * PAGE_SIZE,
                        total
                      )} of ${total}`}
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={!hasNext || options.isFetching || disabled}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
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
            aria-label={`Clear ${label.toLowerCase()}`}
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
