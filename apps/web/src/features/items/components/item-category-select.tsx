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
import { errorMessage, itemCategoryApi } from '@/features/item-categories/api'

const PAGE_SIZE = 20

export type ItemCategoryOption = {
  uuid: string
  name: string
  pathstring: string
}

export function ItemCategorySelect({
  value,
  fallbackUuid = null,
  disabled = false,
  label = 'Category',
  structural = false,
  excludeUuid = null,
  onChange,
}: {
  value: ItemCategoryOption | null
  /** Loaded record UUID to label only when the captured summary is missing. */
  fallbackUuid?: string | null
  disabled?: boolean
  label?: string
  /**
   * Kind filter for the listed categories: `false` lists item categories only,
   * `true` lists structural categories only, `'any'` lists both.
   */
  structural?: boolean | 'any'
  /** Hide this category from the results, e.g. the record being edited. */
  excludeUuid?: string | null
  onChange: (next: ItemCategoryOption | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [clearedFor, setClearedFor] = useState<string | null>(null)
  const cleared = clearedFor !== null && clearedFor === fallbackUuid
  const options = useQuery({
    queryKey: [
      'item-category',
      'categories',
      organizationCacheScope(),
      'options',
      page,
      search,
      structural,
    ],
    queryFn: () =>
      itemCategoryApi.categories({
        page,
        search,
        structural: structural === 'any' ? undefined : structural,
        limit: PAGE_SIZE,
      }),
    enabled: open,
  })
  const fallback = useQuery({
    queryKey: [
      'item-category',
      'categories',
      organizationCacheScope(),
      'detail',
      fallbackUuid,
    ],
    queryFn: () => itemCategoryApi.category(fallbackUuid as string),
    enabled: fallbackUuid != null && value == null && !cleared,
  })
  const fallbackOption: ItemCategoryOption | null =
    fallback.data == null
      ? null
      : {
          uuid: fallback.data.uuid,
          name: fallback.data.name,
          pathstring: fallback.data.pathstring,
        }
  const selected = value ?? (cleared ? null : fallbackOption)
  const retainedFallback = fallbackUuid != null && !cleared
  const hasSelection = selected != null || retainedFallback
  const items = (options.data?.items ?? []).filter(
    (category) => category.uuid !== excludeUuid
  )
  const total = options.data?.total ?? 0
  const hasNext = (page + 1) * PAGE_SIZE < total
  const fallbackFailed = fallback.isError && value == null && !cleared

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
                selected == null
                  ? undefined
                  : selected.pathstring || selected.name
              }
              className={cn(
                'relative w-full min-w-0 justify-start ps-3',
                hasSelection ? 'pe-16' : 'pe-9'
              )}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-start',
                  selected == null && 'text-muted-foreground'
                )}
              >
                {selected == null
                  ? `Select ${label.toLowerCase()}`
                  : selected.pathstring || selected.name}
              </span>
              <span
                aria-hidden='true'
                className={cn(
                  'pointer-events-none absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center opacity-50',
                  hasSelection ? 'end-10' : 'end-3'
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
                aria-label='Search categories'
                placeholder='Search categories…'
                value={search}
                onValueChange={(next) => {
                  setSearch(next)
                  setPage(0)
                }}
                disabled={disabled}
              />
              <CommandList>
                {options.isLoading ? (
                  <p
                    role='status'
                    className='p-3 text-sm text-muted-foreground'
                  >
                    Loading categories…
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
                    <CommandEmpty>No categories found.</CommandEmpty>
                    <CommandGroup>
                      {items.map((category) => (
                        <CommandItem
                          key={category.uuid}
                          value={category.uuid}
                          disabled={disabled}
                          onSelect={() => {
                            setClearedFor(null)
                            onChange({
                              uuid: category.uuid,
                              name: category.name,
                              pathstring: category.pathstring,
                            })
                            setOpen(false)
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              'size-4',
                              selected?.uuid === category.uuid
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className='truncate'>
                            {category.pathstring || category.name}
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
                  Previous
                </Button>
                <span className='text-xs text-muted-foreground'>
                  {total === 0
                    ? 'No categories'
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
        {hasSelection && (
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
              setClearedFor(fallbackUuid)
              onChange(null)
            }}
          >
            <XIcon className='size-3.5' />
          </Button>
        )}
      </div>
      {fallbackFailed && (
        <p
          role='alert'
          className='flex items-center gap-2 text-xs text-destructive'
        >
          Could not load the current category name.
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={disabled}
            onClick={() => void fallback.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
    </div>
  )
}
