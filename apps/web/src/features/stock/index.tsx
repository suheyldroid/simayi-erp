import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { locale, t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationScope,
} from '@/lib/organization-navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, stockApi } from './api'
import { branchStockListKey } from './cache'
import { StockAddSheet } from './components/stock-add-sheet'
import type { BranchStockContext } from './components/stock-panel'
import type { StockBalance } from './model'

const PAGE_SIZE = 20

export function StockPage() {
  const { organizationSlug } = useOrganizationScope()
  const context = useOptionalBranch()
  const branch = context?.branch ?? null
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>{t('catalog:stock.title')}</h1>
          <p className='text-muted-foreground'>
            {branch
              ? t('catalog:stock.descriptionBranch', { branch: branch.name })
              : t('catalog:stock.descriptionCompany')}
          </p>
        </div>
        <StockDirectory
          key={`${organizationSlug}:${branch?.uuid ?? 'company'}`}
          branch={branch}
        />
      </Main>
    </>
  )
}

function StockDirectory({ branch }: { branch: BranchStockContext | null }) {
  const lowOnlyId = useId()
  const lowOnlyLabelId = `${lowOnlyId}-label`
  const { organizationSlug } = useOrganizationScope()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [adding, setAdding] = useState(false)
  const branchUuid = branch?.uuid ?? null
  const balances = useQuery({
    queryKey: [...branchStockListKey(branchUuid), page, search, lowOnly],
    queryFn: () =>
      stockApi.balances({
        branchUuid,
        page,
        search,
        low: lowOnly,
        limit: PAGE_SIZE,
      }),
  })
  // A company list shows one position per item and same-company branch, so an
  // item can appear more than once: the branch column and the row identity
  // keep each physical location distinguishable and stable.
  const columns = useMemo<SortableColumn<StockBalance>[]>(() => {
    const columns: SortableColumn<StockBalance>[] = [
      {
        id: 'name',
        header: t('catalog:stock.columns.name'),
        accessorFn: (balance) => balance.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'ipn',
        header: t('catalog:stock.columns.ipn'),
        accessorFn: (balance) => balance.ipn ?? '',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'unit',
        header: t('catalog:stock.columns.unit'),
        accessorFn: (balance) => balance.unit?.code ?? balance.units,
        cell: ({ row }) =>
          row.original.unit?.code ||
          row.original.units ||
          t('catalog:stock.noUnit'),
      },
      {
        id: 'category',
        header: t('catalog:stock.columns.category'),
        accessorFn: (balance) => balance.category?.pathstring ?? '',
        cell: ({ getValue }) => String(getValue() ?? '') || '—',
      },
    ]
    if (branch === null) {
      columns.push({
        id: 'branch',
        header: t('catalog:stock.columns.branch'),
        accessorFn: (balance) => balance.branch.name,
        cell: ({ row }) =>
          `${row.original.branch.name}${
            row.original.branch.active
              ? ''
              : t('catalog:stock.panel.inactiveBranchSuffix')
          }`,
      })
    }
    columns.push(
      {
        id: 'stock',
        header: t('catalog:stock.columns.stock'),
        accessorFn: (balance) => balance.stock,
        enableSorting: false,
        cell: ({ row }) => (
          <span className={row.original.belowMinimum ? 'text-destructive' : ''}>
            {row.original.stock}
          </span>
        ),
      },
      {
        id: 'minimum',
        header: t('catalog:stock.columns.minimum'),
        accessorFn: (balance) => balance.minimumStock,
        enableSorting: false,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: t('catalog:stock.columns.status'),
        accessorFn: (balance) =>
          balance.active
            ? t('catalog:common.active')
            : t('catalog:common.inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: t('catalog:common.actions'),
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            {...organizationLocation(
              organizationSlug,
              row.original.branchUuid,
              '/stock/$itemId',
              { itemId: row.original.itemUuid }
            )}
            aria-label={
              branch === null
                ? t('catalog:stock.viewStockAtBranch', {
                    name: row.original.name,
                    branch: row.original.branch.name,
                  })
                : t('catalog:stock.viewStock', {
                    name: row.original.name,
                  })
            }
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('catalog:common.details')}
          </Link>
        ),
      }
    )
    return columns
  }, [branch, organizationSlug])
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <form
          className='flex flex-wrap items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label={t('catalog:stock.searchLabel')}
            placeholder={t('catalog:stock.searchPlaceholder')}
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>{t('catalog:common.find')}</Button>
          <div className='flex items-center gap-2'>
            <Checkbox
              id={lowOnlyId}
              aria-labelledby={lowOnlyLabelId}
              checked={lowOnly}
              onCheckedChange={(value) => {
                setLowOnly(value === true)
                setPage(0)
              }}
            />
            <Label
              id={lowOnlyLabelId}
              htmlFor={lowOnlyId}
              className='font-normal'
            >
              {t('catalog:stock.lowOnly')}
            </Label>
          </div>
        </form>
        {branch ? (
          <Button
            type='button'
            disabled={!branch.active}
            onClick={() => setAdding(true)}
          >
            {t('catalog:stock.addStock')}
          </Button>
        ) : (
          <p className='max-w-sm text-sm text-muted-foreground'>
            {t('catalog:stock.companyWriteHint')}
          </p>
        )}
      </div>
      {branch && !branch.active && (
        <p role='alert' className='text-sm text-destructive'>
          {t('catalog:stock.inactiveNotice', { name: branch.name })}
        </p>
      )}
      {balances.isPending && <p role='status'>{t('catalog:stock.loading')}</p>}
      {balances.isError && (
        <p role='alert'>
          {errorMessage(balances.error)}{' '}
          <Button variant='outline' onClick={() => void balances.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {balances.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {branch
              ? t('catalog:stock.summary', {
                  branch: branch.name,
                  total: balances.data.total.toLocaleString(locale),
                  sortingNote: t('catalog:common.sortingNote'),
                })
              : t('catalog:stock.summaryCompany', {
                  total: balances.data.total.toLocaleString(locale),
                  sortingNote: t('catalog:common.sortingNote'),
                })}
          </p>
          <SortableDataTable
            data={balances.data.items}
            columns={columns}
            getRowId={(balance) => `${balance.itemUuid}:${balance.branchUuid}`}
            caption={
              branch
                ? t('catalog:stock.caption', { name: branch.name })
                : t('catalog:stock.captionCompany')
            }
            emptyMessage={
              branch
                ? t('catalog:stock.empty')
                : t('catalog:stock.emptyCompany')
            }
          />
          <PageControls
            page={page}
            hasNext={(page + 1) * balances.data.limit < balances.data.total}
            loading={balances.isFetching}
            onChange={setPage}
          />
        </>
      )}
      {adding && branch && branch.active && (
        <StockAddSheet branch={branch} onClose={() => setAdding(false)} />
      )}
    </div>
  )
}
