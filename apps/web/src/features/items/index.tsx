import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationScope,
} from '@/lib/organization-navigation'
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

const itemLabel = (item: Item) =>
  item.name || item.ipn || t('catalog:items.fallbackName')

export function ItemsCatalog() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>{t('catalog:items.title')}</h2>
        <p className='text-muted-foreground'>
          {t('catalog:items.description')}
        </p>
      </div>
      <ItemDirectory />
    </section>
  )
}

function CreateItemAction() {
  const navigate = useNavigate()
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const [open, setOpen] = useState(false)
  // The catalog write is a company request and survives a scope switch, so the
  // destination scope is captured when the form opens: a stale settlement never
  // navigates the newly selected scope.
  const captured = useRef<CapturedBranchScope | null>(null)
  return (
    <>
      <Button
        type='button'
        onClick={() => {
          captured.current = captureBranchScope(branchUuid)
          setOpen(true)
        }}
      >
        {t('catalog:items.new')}
      </Button>
      <ItemForm
        draft={open ? { mode: 'create' } : null}
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          const scope = captured.current
          if (scope === null || !isBranchScopeCurrent(scope)) return
          void navigate(
            organizationLocation(
              organizationSlug,
              scope.branchUuid,
              '/settings/items/$itemId',
              { itemId: saved.uuid }
            )
          )
        }}
      />
    </>
  )
}

function ItemDirectory() {
  const { organizationSlug, branchUuid } = useOrganizationScope()
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
        header: t('catalog:common.name'),
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
        header: t('catalog:common.category'),
        accessorFn: (item) => item.category?.pathstring ?? '',
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
            aria-label={t('catalog:items.searchLabel')}
            placeholder={t('catalog:items.searchPlaceholder')}
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>{t('catalog:common.find')}</Button>
        </form>
        <CreateItemAction />
      </div>
      {items.isPending && <p role='status'>{t('catalog:items.loading')}</p>}
      {items.isError && (
        <p role='alert'>
          {errorMessage(items.error)}{' '}
          <Button variant='outline' onClick={() => void items.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {items.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:items.summary', {
              total: items.data.total.toLocaleString(locale),
              sortingNote: t('catalog:common.sortingNote'),
            })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:items.openHint')}
          </p>
          <SortableDataTable
            data={items.data.items}
            columns={columns}
            getRowId={(item) => item.uuid}
            caption={t('catalog:items.caption')}
            emptyMessage={t('catalog:items.empty')}
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
