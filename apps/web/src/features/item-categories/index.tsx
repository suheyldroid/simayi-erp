import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, itemCategoryApi } from './api'
import { CategoryForm } from './components/category-form'
import type { Category } from './model'

const PAGE_SIZE = 20

type Scope = 'all' | 'roots'
type Kind = 'all' | 'structural' | 'items'

export function ItemCategories() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Item categories</h2>
        <p className='text-muted-foreground'>
          Category tree and the item categories inside it.
        </p>
      </div>
      <CategoryDirectory />
    </section>
  )
}

function CreateCategoryAction() {
  const navigate = useNavigate()
  const organizationSlug = useOrganizationSlug()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' onClick={() => setOpen(true)}>
        New category
      </Button>
      <CategoryForm
        draft={open ? { mode: 'create' } : null}
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          void navigate({
            to: '/o/$organizationSlug/settings/item-categories/$categoryId',
            params: { organizationSlug, categoryId: saved.uuid },
          })
        }}
      />
    </>
  )
}

function CategoryDirectory() {
  const organizationSlug = useOrganizationSlug()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [kind, setKind] = useState<Kind>('all')
  const categories = useQuery({
    queryKey: [
      'item-category',
      'categories',
      organizationCacheScope(),
      'list',
      page,
      search,
      scope,
      kind,
    ],
    queryFn: () =>
      itemCategoryApi.categories({
        page,
        search,
        roots: scope === 'roots' ? true : undefined,
        structural:
          kind === 'structural' ? true : kind === 'items' ? false : undefined,
        limit: PAGE_SIZE,
      }),
  })
  const columns = useMemo<SortableColumn<Category>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (category) => category.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'pathstring',
        header: 'Path',
        accessorFn: (category) => category.pathstring,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'kind',
        header: 'Kind',
        accessorFn: (category) =>
          category.structural ? 'Structural' : 'Items',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'items',
        header: 'Items',
        accessorFn: (category) => category.itemCount,
        meta: { numeric: true },
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'children',
        header: 'Children',
        accessorFn: (category) => category.childCount,
        meta: { numeric: true },
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { label: 'Actions', width: 110 },
        cell: ({ row }) => (
          <Link
            to='/o/$organizationSlug/settings/item-categories/$categoryId'
            params={{
              organizationSlug,
              categoryId: row.original.uuid,
            }}
            aria-label={`View details for ${
              row.original.pathstring || row.original.name
            }`}
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
          className='flex flex-wrap items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label='Search categories'
            placeholder='Search name, path, or description'
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Select
            value={scope}
            onValueChange={(value) => {
              if (value === 'all' || value === 'roots') {
                setScope(value)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className='w-40' aria-label='Category scope'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All categories</SelectItem>
              <SelectItem value='roots'>Root categories</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={kind}
            onValueChange={(value) => {
              if (
                value === 'all' ||
                value === 'structural' ||
                value === 'items'
              ) {
                setKind(value)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className='w-40' aria-label='Category kind'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Any kind</SelectItem>
              <SelectItem value='structural'>Structural</SelectItem>
              <SelectItem value='items'>Item categories</SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline'>Find</Button>
        </form>
        <CreateCategoryAction />
      </div>
      {categories.isPending && <p role='status'>Loading categories…</p>}
      {categories.isError && (
        <p role='alert'>
          {errorMessage(categories.error)}{' '}
          <Button variant='outline' onClick={() => void categories.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {categories.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {categories.data.total} categories. Sorting applies to this page
            only.
          </p>
          <p className='text-sm text-muted-foreground'>
            Select Details in a row to open its category.
          </p>
          <SortableDataTable
            data={categories.data.items}
            columns={columns}
            getRowId={(category) => category.uuid}
            caption='Item categories'
            emptyMessage='No categories match these filters.'
          />
        </>
      )}
      <PageControls
        page={page}
        loading={categories.isFetching}
        hasNext={
          !!categories.data &&
          (page + 1) * categories.data.limit < categories.data.total
        }
        onChange={setPage}
      />
    </div>
  )
}
