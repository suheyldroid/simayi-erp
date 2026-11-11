import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, salesApi } from './api'
import { SaleForm } from './components/sale-create'
import type { SaleInput, SaleSummary } from './model'

export function SalesPage() {
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Sales</h1>
          <p className='text-muted-foreground'>
            Completed sales are permanent records. Open a sale to review its
            recipe snapshot and the stock consumed to fulfil it.
          </p>
        </div>
        <SalesDirectory />
      </Main>
    </>
  )
}

function saleColumns(organizationSlug: string): SortableColumn<SaleSummary>[] {
  return [
    {
      id: 'reference',
      header: 'Reference',
      accessorFn: (sale) => sale.reference || sale.referenceInt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'recipe',
      header: 'Recipe',
      accessorFn: (sale) => sale.recipeName,
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'version',
      header: 'Version',
      accessorFn: (sale) => sale.recipeVersion,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorFn: (sale) => sale.quantity,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'ingredients',
      header: 'Ingredients',
      accessorFn: (sale) => sale.ingredientCount,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'recorded',
      header: 'Recorded',
      accessorFn: (sale) => new Date(sale.createdAt).getTime(),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      id: 'staff',
      header: 'Staff',
      accessorFn: (sale) => sale.createdByName,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const sale = row.original
        const label = sale.reference || sale.referenceInt || sale.uuid
        return (
          <Link
            to='/o/$organizationSlug/sales/$saleId'
            params={{ organizationSlug, saleId: sale.uuid }}
            aria-label={`Details for sale ${label}`}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        )
      },
    },
  ]
}

function SalesDirectory() {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const columns = useMemo(
    () => saleColumns(organizationSlug),
    [organizationSlug]
  )
  const sales = useQuery({
    queryKey: ['sales', organizationCacheScope(), 'list', page, search],
    queryFn: () => salesApi.list({ page, search }),
  })
  const creation = useMutation({
    mutationFn: (input: { body: SaleInput; scope: string }) =>
      salesApi.record(input.body),
    onSuccess: async (sale, input) => {
      setCreating(false)
      await client.invalidateQueries({
        queryKey: ['sales', input.scope],
      })
      await invalidateItemStockCaches(client, input.scope)
      toast.success('Sale recorded')
      await navigate({
        to: '/o/$organizationSlug/sales/$saleId',
        params: { organizationSlug, saleId: sale.uuid },
      })
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const data = sales.data
  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button type='button' onClick={() => setCreating(true)}>
          Record sale
        </Button>
      </div>
      <form
        className='flex flex-wrap gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSearch(draft)
        }}
      >
        <Input
          aria-label='Search sales'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder='Search sales'
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>Find</Button>
      </form>
      {sales.isPending && <p role='status'>Loading sales…</p>}
      {sales.isError && (
        <p role='alert'>
          {errorMessage(sales.error)}{' '}
          <Button variant='outline' onClick={() => void sales.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {data.total} sales. Sorting applies to this page only.
          </p>
          <p className='text-sm text-muted-foreground'>
            Select Details on a sale to open it.
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(sale) => sale.uuid}
            caption='Recorded sales'
            emptyMessage='No sales match this search.'
          />
        </>
      )}
      <PageControls
        page={page}
        loading={sales.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {creating && (
        <SaleForm
          pending={creation.isPending}
          error={creation.error}
          onClose={() => setCreating(false)}
          onSubmit={(body) =>
            creation.mutate({ body, scope: organizationCacheScope() })
          }
        />
      )}
    </div>
  )
}
