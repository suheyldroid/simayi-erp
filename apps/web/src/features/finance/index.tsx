import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
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
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, financeApi } from './api'
import { MoneyForm } from './components/money-form'
import {
  movementKindLabel,
  movementStatusLabel,
  type MoneyInput,
  type MoneyMovement,
} from './model'

type EntryForm = 'income' | 'expense'

function movementColumns(
  organizationSlug: string,
  branchUuid: string | null
): SortableColumn<MoneyMovement>[] {
  return [
    {
      id: 'date',
      header: t('operations:finance.list.columns.date'),
      accessorFn: (movement) => movement.occurredAt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'type',
      header: t('operations:finance.list.columns.type'),
      accessorFn: (movement) => movementKindLabel(movement.kind),
      cell: ({ row }) => movementKindLabel(row.original.kind),
    },
    {
      id: 'amount',
      header: t('operations:finance.list.columns.amount'),
      accessorFn: (movement) => movement.amount,
      cell: ({ row }) => `${row.original.amount} ${row.original.currencyCode}`,
    },
    {
      id: 'supplier',
      header: t('operations:finance.list.columns.supplier'),
      accessorFn: (movement) => movement.supplierName ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'branch',
      header: t('operations:finance.list.columns.branch'),
      accessorFn: (movement) => movement.branchName ?? '',
      cell: ({ getValue }) =>
        String(getValue() ?? '') || t('operations:finance.companyWide'),
    },
    {
      id: 'purchase',
      header: t('operations:finance.list.columns.purchaseOrder'),
      accessorFn: (movement) => movement.purchaseOrderReference ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'sale',
      header: t('operations:finance.list.columns.sale'),
      accessorFn: (movement) => movement.saleReference ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'note',
      header: t('operations:finance.list.columns.note'),
      accessorFn: (movement) => movement.note,
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'status',
      header: t('operations:finance.list.columns.status'),
      accessorFn: (movement) => movementStatusLabel(movement),
      cell: ({ row }) => movementStatusLabel(row.original),
    },
    {
      id: 'actions',
      header: t('operations:finance.list.columns.actions'),
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          {...organizationLocation(
            organizationSlug,
            branchUuid,
            '/finance/$movementId',
            { movementId: row.original.uuid }
          )}
          aria-label={t('operations:finance.list.detailsLabel', {
            uuid: row.original.uuid,
          })}
          className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          {t('operations:finance.list.details')}
        </Link>
      ),
    },
  ]
}

export function FinancePage() {
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>
            {t('operations:finance.index.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('operations:finance.index.description')}
          </p>
        </div>
        <FinanceDirectory />
      </Main>
    </>
  )
}

function FinanceDirectory() {
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<EntryForm | null>(null)
  const columns = useMemo(
    () => movementColumns(organizationSlug, branchUuid),
    [organizationSlug, branchUuid]
  )
  const summary = useQuery({
    queryKey: ['finance', scope, 'summary'],
    queryFn: () => financeApi.summary(),
  })
  const movements = useQuery({
    queryKey: ['finance', scope, 'list', page, search],
    queryFn: () => financeApi.movements({ page, search }),
  })
  const invalidateFinance = async () => {
    await client.invalidateQueries({ queryKey: ['finance', scope] })
  }
  const income = useMutation({
    mutationFn: (input: { body: MoneyInput; scope: string }) =>
      financeApi.income(input.body),
    onSuccess: async (_movement, input) => {
      setForm(null)
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      toast.success(t('operations:finance.list.incomeRecorded'))
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const expense = useMutation({
    mutationFn: (input: { body: MoneyInput; scope: string }) =>
      financeApi.expense(input.body),
    onSuccess: async (_movement, input) => {
      setForm(null)
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      toast.success(t('operations:finance.list.expenseRecorded'))
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const summaryData = summary.data
  const data = movements.data
  const activeMutation = form === 'income' ? income : expense
  const pending = income.isPending || expense.isPending
  return (
    <div className='space-y-4'>
      <section className='space-y-2 rounded-md border border-border p-4'>
        <h2 className='text-xl font-semibold'>
          {t('operations:finance.summary.title')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('operations:finance.summary.description')}
        </p>
        {summary.isPending && (
          <p role='status'>{t('operations:finance.summary.loading')}</p>
        )}
        {summary.isError && (
          <p role='alert'>
            {errorMessage(summary.error)}{' '}
            <Button variant='outline' onClick={() => void summary.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}
        {summaryData && !summaryData.configured && (
          <div className='space-y-1 text-sm'>
            <p>{t('operations:finance.summary.notConfigured')}</p>
            <p className='text-muted-foreground'>
              {t('operations:finance.summary.notConfiguredHint')}
            </p>
          </div>
        )}
        {summaryData && (
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>{t('operations:finance.summary.fields.currency')}</dt>
            <dd>
              {summaryData.currencyCode ??
                t('operations:finance.notConfigured')}
            </dd>
            <dt>{t('operations:finance.summary.fields.balance')}</dt>
            <dd className='font-medium'>
              {summaryData.balance}
              {summaryData.currencyCode ? ` ${summaryData.currencyCode}` : ''}
            </dd>
            <dt>{t('operations:finance.summary.fields.onHold')}</dt>
            <dd>
              {summaryData.onHold}
              {summaryData.currencyCode ? ` ${summaryData.currencyCode}` : ''}
            </dd>
            <dt>{t('operations:finance.summary.fields.available')}</dt>
            <dd className='font-medium'>
              {summaryData.availableBalance}
              {summaryData.currencyCode ? ` ${summaryData.currencyCode}` : ''}
            </dd>
            <dt>{t('operations:finance.summary.fields.postedEntries')}</dt>
            <dd>{summaryData.movementCount}</dd>
            <dt>{t('operations:finance.summary.fields.pendingPricing')}</dt>
            <dd>{summaryData.pendingPricingCount}</dd>
          </dl>
        )}
        {summaryData && summaryData.pendingPricingCount > 0 && (
          <p className='text-sm text-muted-foreground'>
            {t('operations:finance.summary.pendingPricingHint')}
          </p>
        )}
      </section>
      <div className='flex flex-wrap items-center justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={() => {
            income.reset()
            setForm('income')
          }}
        >
          {t('operations:finance.list.addIncome')}
        </Button>
        <Button
          type='button'
          onClick={() => {
            expense.reset()
            setForm('expense')
          }}
        >
          {t('operations:finance.list.addExpense')}
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
          aria-label={t('operations:finance.list.searchLabel')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('operations:finance.list.searchPlaceholder')}
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>{t('operations:common.find')}</Button>
      </form>
      {movements.isPending && (
        <p role='status'>{t('operations:finance.list.loading')}</p>
      )}
      {movements.isError && (
        <p role='alert'>
          {errorMessage(movements.error)}{' '}
          <Button variant='outline' onClick={() => void movements.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('operations:finance.list.total', { count: data.total })}
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(movement) => movement.uuid}
            caption={t('operations:finance.list.caption')}
            emptyMessage={
              search
                ? t('operations:finance.list.emptySearch')
                : t('operations:finance.list.empty')
            }
          />
        </>
      )}
      <PageControls
        page={page}
        loading={movements.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {form !== null && (
        <MoneyForm
          title={
            form === 'income'
              ? t('operations:finance.list.addIncome')
              : t('operations:finance.list.addExpense')
          }
          description={
            form === 'income'
              ? t('operations:finance.list.incomeDescription')
              : t('operations:finance.list.expenseDescription')
          }
          currencyCode={summaryData?.currencyCode ?? null}
          submitLabel={
            form === 'income'
              ? t('operations:finance.list.addIncome')
              : t('operations:finance.list.addExpense')
          }
          pending={pending}
          error={activeMutation.error}
          onClose={() => {
            if (!pending) {
              setForm(null)
              void invalidateFinance()
            }
          }}
          onSubmit={(input) => {
            if (form === 'income') income.mutate({ body: input, scope })
            else expense.mutate({ body: input, scope })
          }}
        />
      )}
    </div>
  )
}
