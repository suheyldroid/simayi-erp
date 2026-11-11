import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
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
import { errorMessage, itemApi } from '@/features/items/api'
import type { Item } from '@/features/items/model'
import { PageControls } from '@/features/users/components/page-controls'
import { StockAddSheet } from './components/stock-add-sheet'

const PAGE_SIZE = 20

const itemLabel = (item: Item) => item.name || item.ipn || 'Item'

export function StockPage() {
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Stock</h1>
          <p className='text-muted-foreground'>
            Stock balances for every item. Add, remove, or count stock and
            review the recorded history.
          </p>
        </div>
        <StockDirectory />
      </Main>
    </>
  )
}

function StockDirectory() {
  const organizationSlug = useOrganizationSlug()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const items = useQuery({
    queryKey: ['stock', organizationCacheScope(), 'list', page, search],
    queryFn: () => itemApi.items({ page, search, limit: PAGE_SIZE }),
  })
  const columns = useMemo<SortableColumn<Item>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (item) => itemLabel(item),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'units',
        header: 'Unit',
        accessorFn: (item) => item.units,
        cell: ({ getValue }) => String(getValue() ?? '') || '—',
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (item) => item.category?.pathstring ?? '',
        cell: ({ getValue }) => String(getValue() ?? '') || '—',
      },
      {
        id: 'stock',
        header: 'Stock',
        accessorFn: (item) => item.stock,
        enableSorting: false,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'minimum',
        header: 'Minimum',
        accessorFn: (item) => item.minimumStock,
        enableSorting: false,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (item) => (item.active ? 'Active' : 'Inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to='/o/$organizationSlug/stock/$itemId'
            params={{
              organizationSlug,
              itemId: row.original.uuid,
            }}
            aria-label={`View stock for ${itemLabel(row.original)}`}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        ),
      },
    ],
    [organizationSlug]
  )
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label='Search stock'
            placeholder='Search name, description, or IPN'
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>Find</Button>
        </form>
        <Button type='button' onClick={() => setAdding(true)}>
          Add stock
        </Button>
      </div>
      {items.isPending && <p role='status'>Loading stock…</p>}
      {items.isError && (
        <p role='alert'>
          {errorMessage(items.error)}{' '}
          <Button variant='outline' onClick={() => void items.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {items.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {items.data.total} items. Sorting applies to this page only.
          </p>
          <SortableDataTable
            data={items.data.items}
            columns={columns}
            getRowId={(item) => item.uuid}
            caption='Stock balances'
            emptyMessage='No items match this search.'
          />
          <PageControls
            page={page}
            hasNext={(page + 1) * items.data.limit < items.data.total}
            loading={items.isFetching}
            onChange={setPage}
          />
        </>
      )}
      {adding && <StockAddSheet onClose={() => setAdding(false)} />}
    </div>
  )
}
