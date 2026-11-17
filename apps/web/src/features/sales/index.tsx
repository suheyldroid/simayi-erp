import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch, type BranchContext } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { invalidateBranchStockCaches } from '@/lib/item-stock-cache'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationLocation } from '@/lib/organization-navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, salesApi } from './api'
import { SaleForm } from './components/sale-create'
import type { SaleInput, SaleSummary } from './model'

/**
 * Company context lists every branch's sales; a branch path filters exactly
 * its own branch. Every row keeps its recorded branch attribution, so a
 * company row always opens the branch that owns the sale.
 */
export function SalesPage() {
  const branch = useOptionalBranch()
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>
            {t('operations:sales.index.title')}
          </h1>
          <p className='text-muted-foreground'>
            {branch === null
              ? t('operations:sales.index.companyDescription')
              : t('operations:sales.index.description', {
                  branch: branch.branch.name,
                })}
          </p>
        </div>
        {branch !== null && !branch.branch.active && (
          <BranchInactiveNotice branchName={branch.branch.name} />
        )}
        <SalesDirectory branch={branch} />
      </Main>
    </>
  )
}

function saleColumns(
  organizationSlug: string,
  companyMode: boolean
): SortableColumn<SaleSummary>[] {
  return [
    {
      id: 'reference',
      header: t('operations:sales.list.columns.reference'),
      accessorFn: (sale) => sale.reference || sale.referenceInt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    ...(companyMode
      ? [
          {
            id: 'branch',
            header: t('operations:sales.list.columns.branch'),
            accessorFn: (sale: SaleSummary) => sale.branch.name,
            cell: ({ row }: { row: { original: SaleSummary } }) =>
              row.original.branch.name,
          } satisfies SortableColumn<SaleSummary>,
        ]
      : []),
    {
      id: 'recipe',
      header: t('operations:sales.list.columns.recipe'),
      accessorFn: (sale) => sale.recipeName,
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'version',
      header: t('operations:sales.list.columns.version'),
      accessorFn: (sale) => sale.recipeVersion,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'quantity',
      header: t('operations:sales.list.columns.quantity'),
      accessorFn: (sale) => sale.quantity,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'total',
      header: t('operations:sales.list.columns.total'),
      accessorFn: (sale) => sale.totalPrice ?? '',
      cell: ({ row }) =>
        row.original.totalPrice === null
          ? '—'
          : `${row.original.totalPrice} ${row.original.currencyCode ?? ''}`.trim(),
    },
    {
      id: 'ingredients',
      header: t('operations:sales.list.columns.ingredients'),
      accessorFn: (sale) => sale.ingredientCount,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'channel',
      header: t('operations:sales.list.columns.channel'),
      accessorFn: (sale) => sale.channelName ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'businessDate',
      header: t('operations:sales.list.columns.businessDate'),
      accessorFn: (sale) => sale.businessDate ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'recorded',
      header: t('operations:sales.list.columns.recorded'),
      accessorFn: (sale) => new Date(sale.createdAt).getTime(),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleString(locale),
    },
    {
      id: 'staff',
      header: t('operations:sales.list.columns.staff'),
      accessorFn: (sale) => sale.createdByName,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'actions',
      header: t('operations:sales.list.columns.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const sale = row.original
        const label = sale.reference || sale.referenceInt || sale.uuid
        return (
          <Link
            {...organizationLocation(
              organizationSlug,
              sale.branch.uuid,
              '/sales/$saleId',
              { saleId: sale.uuid }
            )}
            aria-label={t('operations:sales.list.detailsLabel', { label })}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:sales.list.details')}
          </Link>
        )
      },
    },
  ]
}

function SalesDirectory({ branch }: { branch: BranchContext | null }) {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const branchUuid = branch?.branchUuid ?? null
  const companyMode = branchUuid === null
  const scopeKey = branchCacheScope(branchUuid)
  const writable = branch !== null && branch.branch.active
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [createCapture, setCreateCapture] =
    useState<CapturedBranchScope | null>(null)
  const columns = useMemo(
    () => saleColumns(organizationSlug, companyMode),
    [organizationSlug, companyMode]
  )
  const sales = useQuery({
    queryKey: ['sales', scopeKey, 'list', page, search, branchUuid],
    queryFn: () => salesApi.list(branchUuid, { page, search }),
  })
  const creation = useMutation({
    mutationFn: (input: { body: SaleInput; captured: CapturedBranchScope }) => {
      if (input.captured.branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesApi.record(input.captured.branchUuid, input.body)
    },
    onSuccess: async (sale, input) => {
      // A branch sale is also a new row of the company aggregate list of the
      // same organization; both captured keys go stale together.
      const companyScope = `${input.captured.organizationScope}::company`
      await Promise.all([
        client.invalidateQueries({ queryKey: ['sales', input.captured.scope] }),
        client.invalidateQueries({ queryKey: ['sales', companyScope] }),
        invalidateBranchStockCaches(client, input.captured),
      ])
      if (!isBranchScopeCurrent(input.captured)) return
      setCreateCapture(null)
      toast.success(t('operations:sales.list.recorded'))
      const owningBranchUuid = input.captured.branchUuid
      if (owningBranchUuid === null) return
      await navigate({
        to: '/o/$organizationSlug/b/$branchUuid/sales/$saleId',
        params: {
          organizationSlug,
          branchUuid: owningBranchUuid,
          saleId: sale.uuid,
        },
      })
    },
    onError: (caught, input) => {
      if (!isBranchScopeCurrent(input.captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const data = sales.data
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-end gap-2'>
        <Button variant='outline' asChild>
          <Link
            {...organizationLocation(
              organizationSlug,
              branchUuid,
              '/sales/batches'
            )}
          >
            {t('operations:sales.list.batches')}
          </Link>
        </Button>
        <Button
          type='button'
          disabled={!writable}
          title={
            companyMode
              ? t('operations:sales.list.selectBranchForWrite')
              : undefined
          }
          onClick={() => {
            creation.reset()
            setCreateCapture(captureBranchScope(branchUuid))
          }}
        >
          {t('operations:sales.list.record')}
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
          aria-label={t('operations:sales.list.searchLabel')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('operations:sales.list.searchPlaceholder')}
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>{t('operations:common.find')}</Button>
      </form>
      {sales.isPending && (
        <p role='status'>{t('operations:sales.list.loading')}</p>
      )}
      {sales.isError && (
        <p role='alert'>
          {errorMessage(sales.error)}{' '}
          <Button variant='outline' onClick={() => void sales.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {companyMode
              ? t('operations:sales.list.totalCompany', {
                  count: data.total.toLocaleString(locale),
                })
              : t('operations:sales.list.total', {
                  count: data.total.toLocaleString(locale),
                  branch: branch?.branch.name ?? '',
                })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('operations:sales.list.openHint')}
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(sale) => sale.uuid}
            caption={
              companyMode
                ? t('operations:sales.list.captionCompany')
                : t('operations:sales.list.caption', {
                    branch: branch?.branch.name ?? '',
                  })
            }
            emptyMessage={
              search
                ? t('operations:sales.list.empty')
                : companyMode
                  ? t('operations:sales.list.emptyCompany')
                  : t('operations:sales.list.empty')
            }
          />
        </>
      )}
      <PageControls
        page={page}
        loading={sales.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {createCapture !== null && branch !== null && (
        <SaleForm
          branchName={branch.branch.name}
          pending={creation.isPending}
          error={creation.error}
          onClose={() => {
            setCreateCapture(null)
            creation.reset()
          }}
          onSubmit={(body) =>
            creation.mutate({ body, captured: createCapture })
          }
        />
      )}
    </div>
  )
}
