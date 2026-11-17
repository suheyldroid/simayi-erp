import { useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationResourceParams,
  useOrganizationScope,
} from '@/lib/organization-navigation'
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

const categoryLabel = (pathstring: string, name: string) =>
  pathstring || name || t('catalog:itemCategories.fallbackName')

const PAGE_SIZE = 20

const itemLabel = (item: Item) =>
  item.name || item.ipn || t('catalog:items.fallbackName')

function CategoryItems({ uuid }: { uuid: string }) {
  const { organizationSlug, branchUuid } = useOrganizationScope()
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
        header: t('catalog:itemCategories.columns.name'),
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
        id: 'status',
        header: t('catalog:common.status'),
        accessorFn: (item) =>
          item.active
            ? t('catalog:common.active')
            : t('catalog:common.inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: t('catalog:common.actions'),
        enableSorting: false,
        meta: { label: t('catalog:common.actions'), width: 110 },
        cell: ({ row }) => (
          <Link
            {...organizationLocation(
              organizationSlug,
              branchUuid,
              '/settings/items/$itemId',
              { itemId: row.original.uuid }
            )}
            aria-label={t('catalog:items.viewDetails', {
              name: itemLabel(row.original),
            })}
            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('catalog:common.details')}
          </Link>
        ),
      },
    ],
    [organizationSlug, branchUuid]
  )
  return (
    <section className='space-y-2'>
      <h3 className='text-xl font-semibold'>
        {t('catalog:itemCategories.itemsHeading')}
      </h3>
      {categoryItems.isPending && (
        <p role='status'>{t('catalog:items.loading')}</p>
      )}
      {categoryItems.isError && (
        <p role='alert'>
          {errorMessage(categoryItems.error)}{' '}
          <Button
            variant='outline'
            onClick={() => void categoryItems.refetch()}
          >
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {categoryItems.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:itemCategories.itemsSummary', {
              total: categoryItems.data.total.toLocaleString(locale),
              sortingNote: t('catalog:common.sortingNote'),
            })}
          </p>
          <SortableDataTable
            data={categoryItems.data.items}
            columns={columns}
            getRowId={(item) => item.uuid}
            caption={t('catalog:itemCategories.itemsCaption')}
            emptyMessage={t('catalog:itemCategories.itemsEmpty')}
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
        {t('catalog:common.edit')}
      </Button>
      <CategoryForm
        draft={open ? { mode: 'edit', category } : null}
        canSubmit={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function AddChildCategoryAction({ category }: { category: Category }) {
  const navigate = useNavigate()
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const [open, setOpen] = useState(false)
  // The catalog write is a company request that survives a scope switch; the
  // destination scope is captured when the child form opens.
  const captured = useRef<CapturedBranchScope | null>(null)
  return (
    <>
      <Button
        type='button'
        variant='outline'
        onClick={() => {
          captured.current = captureBranchScope(branchUuid)
          setOpen(true)
        }}
      >
        {t('catalog:itemCategories.addChild')}
      </Button>
      <CategoryForm
        draft={
          open ? { mode: 'create-child', parentUuid: category.uuid } : null
        }
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          const scope = captured.current
          if (scope === null || !isBranchScopeCurrent(scope)) return
          void navigate(
            organizationLocation(
              organizationSlug,
              scope.branchUuid,
              '/settings/item-categories/$categoryId',
              { categoryId: saved.uuid }
            )
          )
        }}
      />
    </>
  )
}

function DeleteCategoryAction({ category }: { category: Category }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const [open, setOpen] = useState(false)
  const deletion = useMutation({
    mutationFn: itemCategoryApi.removeCategory,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['item-category'] })
      await client.invalidateQueries({ queryKey: ['item'] })
      setOpen(false)
      toast.success(t('catalog:itemCategories.deletedToast'))
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
        {t('catalog:common.delete')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('catalog:itemCategories.deleteTitle')}
        desc={t('catalog:itemCategories.deleteDescription')}
        confirmText={t('catalog:common.delete')}
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          const ui = captureBranchScope(branchUuid)
          deletion.mutate(category.uuid, {
            onSuccess: () => {
              // Only the scope that confirmed the deletion is redirected back
              // to its own category list.
              if (!isBranchScopeCurrent(ui)) return
              void navigate(
                organizationLocation(
                  organizationSlug,
                  ui.branchUuid,
                  '/settings/item-categories'
                )
              )
            },
          })
        }}
      />
    </>
  )
}

export function CategoryDetail() {
  const { categoryId, organizationSlug, branchUuid } =
    useOrganizationResourceParams()
  const uuid = parseResourceUuid(categoryId ?? '')
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
          {...organizationLocation(
            organizationSlug,
            branchUuid,
            '/settings/item-categories'
          )}
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          {t('catalog:itemCategories.back')}
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {liveCategory
            ? categoryLabel(liveCategory.pathstring, liveCategory.name)
            : t('catalog:itemCategories.detailTitle')}
        </h2>
      </div>
      {uuid === null && (
        <p role='alert'>{t('catalog:itemCategories.notFound')}</p>
      )}
      {uuid !== null && details.isPending && (
        <p role='status'>{t('catalog:itemCategories.loadingOne')}</p>
      )}
      {details.isError && detailStatus === 404 && (
        <p role='alert'>{t('catalog:itemCategories.notFound')}</p>
      )}
      {details.isError && detailStatus !== 404 && (
        <p role='alert'>
          {t('catalog:itemCategories.loadError')}{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {liveCategory && category && !details.isError && (
        <>
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h3 className='text-xl font-semibold'>
                  {t('catalog:itemCategories.detailTitle')}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {[
                    t('catalog:items.meta.id', { uuid: category.uuid }),
                    category.structural
                      ? t('catalog:itemCategories.metaStructural')
                      : t('catalog:itemCategories.metaItems'),
                    t('catalog:itemCategories.metaCounts', {
                      items: category.itemCount.toLocaleString(locale),
                      children: category.childCount.toLocaleString(locale),
                    }),
                  ].join(' · ')}
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
                />
                <DeleteCategoryAction
                  key={`delete-${category.uuid}`}
                  category={category}
                />
              </div>
            </div>
            {category.description && (
              <p className='text-sm'>{category.description}</p>
            )}
            {category.parentUuid != null && (
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>{t('catalog:itemCategories.parent')}</dt>
                <dd>
                  <Link
                    {...organizationLocation(
                      organizationSlug,
                      branchUuid,
                      '/settings/item-categories/$categoryId',
                      { categoryId: category.parentUuid }
                    )}
                    className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {category.parentUuid}
                  </Link>
                </dd>
              </dl>
            )}
          </section>
          <section className='space-y-2'>
            <h3 className='text-xl font-semibold'>
              {t('catalog:itemCategories.childrenHeading')}
            </h3>
            {children.isPending && (
              <p role='status'>{t('catalog:itemCategories.childrenLoading')}</p>
            )}
            {children.isError && (
              <p role='alert'>
                {errorMessage(children.error)}{' '}
                <Button
                  variant='outline'
                  onClick={() => void children.refetch()}
                >
                  {t('catalog:common.retry')}
                </Button>
              </p>
            )}
            {children.data && (
              <ul className='space-y-1 text-sm'>
                {children.data.items.map((child) => (
                  <li key={child.uuid}>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        branchUuid,
                        '/settings/item-categories/$categoryId',
                        { categoryId: child.uuid }
                      )}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {categoryLabel(child.pathstring, child.name)}
                    </Link>
                    <span className='text-muted-foreground'>
                      {' · '}
                      {t('catalog:itemCategories.metaCounts', {
                        items: child.itemCount.toLocaleString(locale),
                        children: child.childCount.toLocaleString(locale),
                      })}
                    </span>
                  </li>
                ))}
                {children.data.items.length === 0 && (
                  <li>{t('catalog:itemCategories.childrenEmpty')}</li>
                )}
                {children.data.total > children.data.items.length && (
                  <li className='text-muted-foreground'>
                    {t('catalog:itemCategories.childrenTruncated', {
                      shown: children.data.items.length.toLocaleString(locale),
                      total: children.data.total.toLocaleString(locale),
                    })}
                  </li>
                )}
              </ul>
            )}
          </section>
          <CategoryItems key={`items-${category.uuid}`} uuid={category.uuid} />
        </>
      )}
    </section>
  )
}
