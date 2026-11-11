import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { itemApi } from '@/features/items/api'
import type { Item } from '@/features/items/model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, itemCategoryApi } from './api'
import { CategoryForm } from './components/category-form'
import type { Category } from './model'

const categoryRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/settings/item-categories/$categoryId'
)

const categoryLabel = (pathstring: string, name: string) =>
  pathstring || name || 'Category'

const PAGE_SIZE = 20

const itemLabel = (item: Item) => item.name || item.ipn || 'Item'

function CategoryItems({
  uuid,
  organizationSlug,
}: {
  uuid: string
  organizationSlug: string
}) {
  const [page, setPage] = useState(0)
  const categoryItems = useQuery({
    queryKey: [
      'item',
      'items',
      organizationCacheScope(),
      'list',
      'category',
      uuid,
      page,
    ],
    queryFn: () =>
      itemApi.items({ categoryUuid: uuid, page, limit: PAGE_SIZE }),
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
    <section className='space-y-2'>
      <h3 className='text-xl font-semibold'>Items</h3>
      {categoryItems.isPending && <p role='status'>Loading items…</p>}
      {categoryItems.isError && (
        <p role='alert'>
          {errorMessage(categoryItems.error)}{' '}
          <Button
            variant='outline'
            onClick={() => void categoryItems.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      {categoryItems.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {categoryItems.data.total} items. Sorting applies to this page only.
          </p>
          <SortableDataTable
            data={categoryItems.data.items}
            columns={columns}
            getRowId={(item) => item.uuid}
            caption='Items in this category'
            emptyMessage='No items in this category.'
          />
          <PageControls
            page={page}
            loading={categoryItems.isFetching}
            hasNext={
              (page + 1) * categoryItems.data.limit < categoryItems.data.total
            }
            onChange={setPage}
          />
        </>
      )}
    </section>
  )
}

function EditCategoryAction({ category }: { category: Category }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' variant='outline' onClick={() => setOpen(true)}>
        Edit
      </Button>
      <CategoryForm
        draft={open ? { mode: 'edit', category } : null}
        canSubmit={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function AddChildCategoryAction({
  category,
  organizationSlug,
}: {
  category: Category
  organizationSlug: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' variant='outline' onClick={() => setOpen(true)}>
        Add child
      </Button>
      <CategoryForm
        draft={
          open ? { mode: 'create-child', parentUuid: category.uuid } : null
        }
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

function DeleteCategoryAction({
  category,
  organizationSlug,
}: {
  category: Category
  organizationSlug: string
}) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const deletion = useMutation({
    mutationFn: itemCategoryApi.removeCategory,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['item-category'] })
      await client.invalidateQueries({ queryKey: ['item'] })
      setOpen(false)
      toast.success('Category deleted')
      await navigate({
        to: '/o/$organizationSlug/settings/item-categories',
        params: { organizationSlug },
      })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <>
      <Button
        type='button'
        variant='outline'
        disabled={deletion.isPending}
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title='Delete category'
        desc='Delete is refused while the category still has child categories or items.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => deletion.mutate(category.uuid)}
      />
    </>
  )
}

export function CategoryDetail() {
  const { categoryId } = categoryRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const uuid = parseResourceUuid(categoryId)
  const details = useQuery({
    queryKey: [
      'item-category',
      'categories',
      organizationCacheScope(),
      'detail',
      uuid,
    ],
    queryFn: () => itemCategoryApi.category(uuid as string),
    enabled: uuid != null,
  })
  const children = useQuery({
    queryKey: [
      'item-category',
      'categories',
      organizationCacheScope(),
      'children',
      uuid,
    ],
    queryFn: () => itemCategoryApi.categories({ parentUuid: uuid as string }),
    enabled: uuid != null,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const category = details.data
  const liveCategory =
    uuid !== null &&
    details.isSuccess &&
    !details.isError &&
    category != null &&
    category.uuid === uuid
      ? category
      : null
  return (
    <section className='space-y-6'>
      <div>
        <Link
          to='/o/$organizationSlug/settings/item-categories'
          params={{ organizationSlug }}
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Back to item categories
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {liveCategory
            ? categoryLabel(liveCategory.pathstring, liveCategory.name)
            : 'Category details'}
        </h2>
      </div>
      {uuid === null && <p role='alert'>Category not found.</p>}
      {uuid !== null && details.isPending && (
        <p role='status'>Loading category…</p>
      )}
      {details.isError && detailStatus === 404 && (
        <p role='alert'>Category not found.</p>
      )}
      {details.isError && detailStatus !== 404 && (
        <p role='alert'>
          Could not load this category.{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {liveCategory && category && !details.isError && (
        <>
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h3 className='text-xl font-semibold'>Category details</h3>
                <p className='text-sm text-muted-foreground'>
                  ID {category.uuid}
                  {category.structural ? ' · structural' : ' · items'}
                  {` · ${category.itemCount} items · ${category.childCount} children`}
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                <EditCategoryAction
                  key={`edit-${category.uuid}`}
                  category={category}
                />
                <AddChildCategoryAction
                  key={`child-${category.uuid}`}
                  category={category}
                  organizationSlug={organizationSlug}
                />
                <DeleteCategoryAction
                  key={`delete-${category.uuid}`}
                  category={category}
                  organizationSlug={organizationSlug}
                />
              </div>
            </div>
            {category.description && (
              <p className='text-sm'>{category.description}</p>
            )}
            {category.parentUuid != null && (
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>Parent</dt>
                <dd>
                  <Link
                    to='/o/$organizationSlug/settings/item-categories/$categoryId'
                    params={{
                      organizationSlug,
                      categoryId: category.parentUuid,
                    }}
                    className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {category.parentUuid}
                  </Link>
                </dd>
              </dl>
            )}
          </section>
          <section className='space-y-2'>
            <h3 className='text-xl font-semibold'>Child categories</h3>
            {children.isPending && <p role='status'>Loading children…</p>}
            {children.isError && (
              <p role='alert'>
                {errorMessage(children.error)}{' '}
                <Button
                  variant='outline'
                  onClick={() => void children.refetch()}
                >
                  Retry
                </Button>
              </p>
            )}
            {children.data && (
              <ul className='space-y-1 text-sm'>
                {children.data.items.map((child) => (
                  <li key={child.uuid}>
                    <Link
                      to='/o/$organizationSlug/settings/item-categories/$categoryId'
                      params={{
                        organizationSlug,
                        categoryId: child.uuid,
                      }}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {categoryLabel(child.pathstring, child.name)}
                    </Link>
                    <span className='text-muted-foreground'>
                      {` · ${child.itemCount} items · ${child.childCount} children`}
                    </span>
                  </li>
                ))}
                {children.data.items.length === 0 && (
                  <li>No child categories.</li>
                )}
                {children.data.total > children.data.items.length && (
                  <li className='text-muted-foreground'>
                    Showing the first {children.data.items.length} of{' '}
                    {children.data.total}.
                  </li>
                )}
              </ul>
            )}
          </section>
          <CategoryItems
            key={`items-${category.uuid}`}
            uuid={category.uuid}
            organizationSlug={organizationSlug}
          />
        </>
      )}
    </section>
  )
}
