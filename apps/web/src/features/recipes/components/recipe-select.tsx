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
import { errorMessage, recipeApi } from '../api'
import type { RecipeSummary } from '../model'

const PAGE_SIZE = 20

export type RecipeOption = Pick<
  RecipeSummary,
  | 'uuid'
  | 'name'
  | 'version'
  | 'ingredientCount'
  | 'sellingPrice'
  | 'priceCurrencyCode'
>

function ingredientCountLabel(count: number) {
  return `${count} ingredient${count === 1 ? '' : 's'}`
}

export function RecipeSelect({
  label,
  value,
  excludeIds = [],
  disabled = false,
  showPrice = true,
  invalid = false,
  describedBy,
  onChange,
}: {
  label: string
  value: RecipeOption | null
  /** Recipes already chosen elsewhere; they stay visible but cannot be picked. */
  excludeIds?: readonly string[]
  disabled?: boolean
  /** Show the recorded price/unpriced badge next to each result. */
  showPrice?: boolean
  /** Marks the combobox invalid when a field-level message explains why. */
  invalid?: boolean
  describedBy?: string
  onChange: (next: RecipeOption | null) => void
}) {
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const options = useQuery({
    queryKey: [
      'recipe',
      'recipes',
      organizationCacheScope(),
      'select',
      'active',
      page,
      search,
    ],
    queryFn: () =>
      recipeApi.recipes({ page, search, active: true, limit: PAGE_SIZE }),
    enabled: open,
  })
  const recipes = options.data?.items ?? []
  const excluded = new Set(excludeIds)
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
                  : `${value.name} · v${value.version} · ${ingredientCountLabel(
                      value.ingredientCount
                    )}`
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
                {value == null ? 'Select recipe' : value.name}
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
                aria-label='Search recipes'
                placeholder='Search active recipes…'
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
                    Loading recipes…
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
                    <CommandEmpty>No recipes found.</CommandEmpty>
                    <CommandGroup>
                      {recipes.map((recipe) => {
                        const alreadyAdded = excluded.has(recipe.uuid)
                        return (
                          <CommandItem
                            key={recipe.uuid}
                            value={recipe.uuid}
                            disabled={disabled || alreadyAdded}
                            onSelect={() => {
                              onChange({
                                uuid: recipe.uuid,
                                name: recipe.name,
                                version: recipe.version,
                                ingredientCount: recipe.ingredientCount,
                                sellingPrice: recipe.sellingPrice,
                                priceCurrencyCode: recipe.priceCurrencyCode,
                              })
                              setOpen(false)
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                'size-4',
                                value?.uuid === recipe.uuid
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <span className='min-w-0 flex-1 truncate'>
                              {recipe.name}
                            </span>
                            <span className='shrink-0 text-xs text-muted-foreground'>
                              {showPrice
                                ? `${
                                    recipe.sellingPrice === null
                                      ? 'Unpriced'
                                      : `${recipe.sellingPrice} ${recipe.priceCurrencyCode ?? ''}`.trim()
                                  } · `
                                : ''}
                              {ingredientCountLabel(recipe.ingredientCount)}
                            </span>
                            {alreadyAdded ? (
                              <span className='shrink-0 text-xs text-muted-foreground'>
                                Already used
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
                  Previous
                </Button>
                <span className='text-xs text-muted-foreground'>
                  {total === 0
                    ? 'No recipes'
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
