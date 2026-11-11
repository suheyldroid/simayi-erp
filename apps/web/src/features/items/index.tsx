import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, itemApi } from './api'
import { ItemForm } from './components/item-form'
import type { Item } from './model'

const PAGE_SIZE = 20

const itemLabel = (item: Item) => item.name || item.ipn || 'Item'

export function ItemsCatalog() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Items</h2>
        <p className='text-muted-foreground'>
          Items, categories, and current stock balances.
        </p>
      </div>
      <ItemDirectory />
    </section>
  )
}

function CreateItemAction() {
  const navigate = useNavigate()
  const organizationSlug = useOrganizationSlug()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' onClick={() => setOpen(true)}>
        New item
      </Button>
      <ItemForm
        draft={open ? { mode: 'create' } : null}
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          void navigate({
            to: '/o/$organizationSlug/settings/items/$itemId',
            params: { organizationSlug, itemId: saved.uuid },
          })
        }}
      />
    </>
  )
}

function ItemDirectory() {
  const organizationSlug = useOrganizationSlug()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const items = useQuery({
    queryKey: ['item', 'items', organizationCacheScope(), 'list', page, search],
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
        id: 'ipn',
        header: 'IPN',
        accessorFn: (item) => item.ipn ?? '',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (item) => item.category?.pathstring ?? '',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'stock',
        header: 'Stock',
        accessorFn: (item) => item.stock,
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
        meta: { label: 'Actions', width: 110 },
        cell: ({ row }) => (
          <Link
            to='/o/$organizationSlug/settings/items/$itemId'
            params={{ organizationSlug, itemId: row.original.uuid }}
            aria-label={`View details for ${itemLabel(row.original)}`}
            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
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
            aria-label='Search items'
            placeholder='Search name, description, or IPN'
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>Find</Button>
        </form>
        <CreateItemAction />
      </div>
      {items.isPending && <p role='status'>Loading items…</p>}
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
          <p className='text-sm text-muted-foreground'>
            Select Details in a row to open its item.
          </p>
          <SortableDataTable
            data={items.data.items}
            columns={columns}
            getRowId={(item) => item.uuid}
            caption='Items'
            emptyMessage='No items match this search.'
          />
        </>
      )}
      <PageControls
        page={page}
        loading={items.isFetching}
        hasNext={
          !!items.data && (page + 1) * items.data.limit < items.data.total
        }
        onChange={setPage}
      />
    </div>
  )
}
