import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
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
  organizationSlug: string
): SortableColumn<MoneyMovement>[] {
  return [
    {
      id: 'date',
      header: 'Date',
      accessorFn: (movement) => movement.occurredAt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (movement) => movementKindLabel(movement.kind),
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorFn: (movement) => movement.amount,
      cell: ({ row }) => `${row.original.amount} ${row.original.currencyCode}`,
    },
    {
      id: 'supplier',
      header: 'Supplier',
      accessorFn: (movement) => movement.supplierName ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'purchase',
      header: 'Purchase order',
      accessorFn: (movement) => movement.purchaseOrderReference ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'sale',
      header: 'Sale',
      accessorFn: (movement) => movement.saleReference ?? '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'note',
      header: 'Note',
      accessorFn: (movement) => movement.note,
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (movement) => movementStatusLabel(movement),
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to='/o/$organizationSlug/finance/$movementId'
          params={{
            organizationSlug,
            movementId: row.original.uuid,
          }}
          aria-label={`Details for money movement ${row.original.uuid}`}
          className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Details
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
          <h1 className='text-2xl font-bold'>Finance</h1>
          <p className='text-muted-foreground'>
            The cash balance is the exact sum of every posted money movement; a
            purchase order reserves what it will cost while it is still open, so
            only the available balance (balance minus on hold) is free. A
            completed purchase posts its exact cash outflow once, and a
            cancelled order releases the reservation without debiting cash.
          </p>
        </div>
        <FinanceDirectory />
      </Main>
    </>
  )
}

function FinanceDirectory() {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<EntryForm | null>(null)
  const columns = useMemo(
    () => movementColumns(organizationSlug),
    [organizationSlug]
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
      toast.success('Income recorded')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const expense = useMutation({
    mutationFn: (input: { body: MoneyInput; scope: string }) =>
      financeApi.expense(input.body),
    onSuccess: async (_movement, input) => {
      setForm(null)
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      toast.success('Expense recorded')
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
        <h2 className='text-xl font-semibold'>Cash balance</h2>
        {summary.isPending && <p role='status'>Loading finance summary…</p>}
        {summary.isError && (
          <p role='alert'>
            {errorMessage(summary.error)}{' '}
            <Button variant='outline' onClick={() => void summary.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {summaryData && !summaryData.configured && (
          <div className='space-y-1 text-sm'>
            <p>Finance is not configured for this organization yet.</p>
            <p className='text-muted-foreground'>
              The first money entry captures the organization currency from the
              system default. Ask a platform administrator to set a system
              default currency if none exists.
            </p>
          </div>
        )}
        {summaryData && (
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>Currency</dt>
            <dd>{summaryData.currencyCode ?? 'Not configured yet'}</dd>
            <dt>Cash balance</dt>
            <dd className='font-medium'>
              {summaryData.balance}
              {summaryData.currencyCode ? ` ${summaryData.currencyCode}` : ''}
            </dd>
            <dt>On hold</dt>
            <dd>
              {summaryData.onHold}
              {summaryData.currencyCode ? ` ${summaryData.currencyCode}` : ''}
            </dd>
            <dt>Available balance</dt>
            <dd className='font-medium'>
              {summaryData.availableBalance}
              {summaryData.currencyCode ? ` ${summaryData.currencyCode}` : ''}
            </dd>
            <dt>Posted entries</dt>
            <dd>{summaryData.movementCount}</dd>
            <dt>Holds awaiting pricing</dt>
            <dd>{summaryData.pendingPricingCount}</dd>
          </dl>
        )}
        {summaryData && summaryData.pendingPricingCount > 0 && (
          <p className='text-sm text-muted-foreground'>
            A purchase order holds only its known priced lines, so its amount
            stays incomplete until every line has a price in the finance
            currency.
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
          Add income
        </Button>
        <Button
          type='button'
          onClick={() => {
            expense.reset()
            setForm('expense')
          }}
        >
          Add expense
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
          aria-label='Search money movements'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder='Search money movements'
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>Find</Button>
      </form>
      {movements.isPending && <p role='status'>Loading money movements…</p>}
      {movements.isError && (
        <p role='alert'>
          {errorMessage(movements.error)}{' '}
          <Button variant='outline' onClick={() => void movements.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {data.total} money movements. Sorting applies to this page only.
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(movement) => movement.uuid}
            caption='Money movements'
            emptyMessage={
              search
                ? 'No money movements match this search.'
                : 'No money movements have been posted yet.'
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
          title={form === 'income' ? 'Add income' : 'Add expense'}
          description={
            form === 'income'
              ? 'General income is a cash inflow. It is not a sale receipt or a supplier payment.'
              : 'A general expense is a cash outflow. It is not a supplier payment.'
          }
          currencyCode={summaryData?.currencyCode ?? null}
          submitLabel={form === 'income' ? 'Add income' : 'Add expense'}
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
