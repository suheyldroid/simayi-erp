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
        <h2 className='text-2xl font-bold'>
          {t('catalog:itemCategories.title')}
        </h2>
        <p className='text-muted-foreground'>
          {t('catalog:itemCategories.description')}
        </p>
      </div>
      <CategoryDirectory />
    </section>
  )
}

function CreateCategoryAction() {
  const navigate = useNavigate()
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const [open, setOpen] = useState(false)
  // The catalog write is a company request that survives a scope switch; the
  // destination scope is captured when the form opens.
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
        {t('catalog:itemCategories.new')}
      </Button>
      <CategoryForm
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
              '/settings/item-categories/$categoryId',
              { categoryId: saved.uuid }
            )
          )
        }}
      />
    </>
  )
}

function CategoryDirectory() {
  const { organizationSlug, branchUuid } = useOrganizationScope()
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
        header: t('catalog:itemCategories.columns.name'),
        accessorFn: (category) => category.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'pathstring',
        header: t('catalog:itemCategories.columns.path'),
        accessorFn: (category) => category.pathstring,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'kind',
        header: t('catalog:itemCategories.columns.kind'),
        accessorFn: (category) =>
          category.structural
            ? t('catalog:itemCategories.kind.structural')
            : t('catalog:itemCategories.kind.items'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'items',
        header: t('catalog:itemCategories.columns.items'),
        accessorFn: (category) => category.itemCount,
        meta: { numeric: true },
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'children',
        header: t('catalog:itemCategories.columns.children'),
        accessorFn: (category) => category.childCount,
        meta: { numeric: true },
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
              '/settings/item-categories/$categoryId',
              { categoryId: row.original.uuid }
            )}
            aria-label={t('catalog:itemCategories.viewDetails', {
              name: row.original.pathstring || row.original.name,
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
          className='flex flex-wrap items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label={t('catalog:itemCategories.searchLabel')}
            placeholder={t('catalog:itemCategories.searchPlaceholder')}
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
            <SelectTrigger
              className='w-40'
              aria-label={t('catalog:itemCategories.filters.scopeLabel')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>
                {t('catalog:itemCategories.filters.scopeAll')}
              </SelectItem>
              <SelectItem value='roots'>
                {t('catalog:itemCategories.filters.scopeRoots')}
              </SelectItem>
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
            <SelectTrigger
              className='w-40'
              aria-label={t('catalog:itemCategories.filters.kindLabel')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>
                {t('catalog:itemCategories.filters.kindAll')}
              </SelectItem>
              <SelectItem value='structural'>
                {t('catalog:itemCategories.filters.kindStructural')}
              </SelectItem>
              <SelectItem value='items'>
                {t('catalog:itemCategories.filters.kindItems')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline'>{t('catalog:common.find')}</Button>
        </form>
        <CreateCategoryAction />
      </div>
      {categories.isPending && (
        <p role='status'>{t('catalog:itemCategories.loading')}</p>
      )}
      {categories.isError && (
        <p role='alert'>
          {errorMessage(categories.error)}{' '}
          <Button variant='outline' onClick={() => void categories.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {categories.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:itemCategories.summary', {
              total: categories.data.total.toLocaleString(locale),
              sortingNote: t('catalog:common.sortingNote'),
            })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:itemCategories.openHint')}
          </p>
          <SortableDataTable
            data={categories.data.items}
            columns={columns}
            getRowId={(category) => category.uuid}
            caption={t('catalog:itemCategories.caption')}
            emptyMessage={t('catalog:itemCategories.empty')}
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
