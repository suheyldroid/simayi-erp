import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, recipeApi } from './api'
import { RecipeSheet } from './components/recipe-sheet'
import type { RecipeCreateInput, RecipeSummary } from './model'

const PAGE_SIZE = 20

export function Recipes() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Recipes</h2>
        <p className='text-muted-foreground'>
          Recipes define the ingredient items, nested recipes and per-unit
          quantities that are deducted from stock when a recipe is sold.
        </p>
      </div>
      <RecipeDirectory />
    </section>
  )
}

function RecipeDirectory() {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const columns = useMemo<SortableColumn<RecipeSummary>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (recipe) => recipe.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'description',
        header: 'Description',
        accessorFn: (recipe) => recipe.description,
        cell: ({ getValue }) => String(getValue() ?? '') || '—',
      },
      {
        id: 'price',
        header: 'Price',
        accessorFn: (recipe) => recipe.sellingPrice ?? '',
        cell: ({ row }) =>
          row.original.sellingPrice === null
            ? '—'
            : `${row.original.sellingPrice} ${row.original.priceCurrencyCode ?? ''}`.trim(),
      },
      {
        id: 'ingredients',
        header: 'Ingredients',
        accessorFn: (recipe) => recipe.ingredientCount,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'active',
        header: 'Active',
        accessorFn: (recipe) => (recipe.active ? 'Active' : 'Inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'version',
        header: 'Version',
        accessorFn: (recipe) => recipe.version,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'updated',
        header: 'Updated',
        accessorFn: (recipe) => new Date(recipe.updatedAt).getTime(),
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { label: 'Actions', width: 110 },
        cell: ({ row }) => (
          <Link
            to='/o/$organizationSlug/settings/recipes/$recipeId'
            params={{
              organizationSlug,
              recipeId: row.original.uuid,
            }}
            aria-label={`Details for recipe ${row.original.name}`}
            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        ),
      },
    ],
    [organizationSlug]
  )
  const recipes = useQuery({
    queryKey: [
      'recipe',
      'recipes',
      organizationCacheScope(),
      'list',
      page,
      search,
    ],
    queryFn: () => recipeApi.recipes({ page, search, limit: PAGE_SIZE }),
  })
  const invalidateRecipeQueries = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['recipe', 'recipes', organizationCacheScope()],
      }),
      client.invalidateQueries({
        queryKey: [
          'recipe',
          'recipes',
          'sales-picker',
          organizationCacheScope(),
        ],
      }),
      // Pricing a recipe captures the organization finance currency, so the
      // finance summary can appear configured after a recipe save; priced
      // recipe data also feeds sale pickers and batch previews.
      client.invalidateQueries({
        queryKey: ['finance', organizationCacheScope()],
      }),
      client.invalidateQueries({
        queryKey: ['sales', organizationCacheScope()],
      }),
    ])
  }
  const creation = useMutation({
    mutationFn: (body: RecipeCreateInput) => recipeApi.create(body),
    onSuccess: async (recipe) => {
      setCreating(false)
      await invalidateRecipeQueries()
      toast.success('Recipe created')
      await navigate({
        to: '/o/$organizationSlug/settings/recipes/$recipeId',
        params: { organizationSlug, recipeId: recipe.uuid },
      })
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const data = recipes.data
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label='Search recipes'
            placeholder='Search recipes'
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>Find</Button>
        </form>
        <Button
          type='button'
          onClick={() => {
            creation.reset()
            setCreating(true)
          }}
        >
          New recipe
        </Button>
      </div>
      {recipes.isPending && <p role='status'>Loading recipes…</p>}
      {recipes.isError && (
        <p role='alert'>
          {errorMessage(recipes.error)}{' '}
          <Button variant='outline' onClick={() => void recipes.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && !recipes.isError && (
        <>
          <p className='text-sm text-muted-foreground'>
            {data.total} recipes. Sorting applies to this page only.
          </p>
          <p className='text-sm text-muted-foreground'>
            Select Details on a recipe to open it.
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(recipe) => recipe.uuid}
            caption='Recipes'
            emptyMessage={
              search
                ? 'No recipes match this search.'
                : 'No recipes have been created yet.'
            }
          />
        </>
      )}
      <PageControls
        page={page}
        loading={recipes.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {creating && (
        <RecipeSheet
          pending={creation.isPending}
          error={creation.error}
          onClose={() => setCreating(false)}
          onSubmit={(body) => creation.mutate(body)}
        />
      )}
    </div>
  )
}
