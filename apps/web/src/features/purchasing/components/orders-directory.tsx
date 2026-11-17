import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationLocation } from '@/lib/organization-navigation'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { errorMessage, purchasingApi } from '../api'
import {
  purchaseOrderStatusLabel,
  type OrderInput,
  type PurchaseOrder,
} from '../model'
import { PurchaseOrderForm, type PurchaseOrderSupplier } from './order-create'

function purchaseOrderColumns(
  organizationSlug: string
): SortableColumn<PurchaseOrder>[] {
  return [
    {
      id: 'reference',
      header: t('operations:purchasing.list.columns.reference'),
      accessorFn: (order) => order.reference || order.referenceInt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'supplier',
      header: t('operations:purchasing.list.columns.supplier'),
      accessorFn: (order) => order.supplier?.name ?? '',
      cell: ({ row }) => row.original.supplier?.name ?? '—',
    },
    {
      id: 'origin',
      header: t('operations:purchasing.list.columns.origin'),
      accessorFn: (order) =>
        order.branch?.name ?? t('operations:purchasing.companyOrigin'),
      cell: ({ row }) =>
        row.original.branch?.name ?? t('operations:purchasing.companyOrigin'),
    },
    {
      id: 'status',
      header: t('operations:purchasing.list.columns.status'),
      accessorFn: (order) => purchaseOrderStatusLabel(order.status),
      cell: ({ row }) => purchaseOrderStatusLabel(row.original.status),
    },
    {
      id: 'total',
      header: t('operations:purchasing.list.columns.total'),
      accessorFn: (order) => order.totalPrice ?? '',
      enableSorting: false,
      cell: ({ row }) => row.original.totalPrice ?? '—',
    },
    {
      id: 'target',
      header: t('operations:purchasing.list.columns.target'),
      accessorFn: (order) => order.targetDate ?? '',
      cell: ({ row }) => row.original.targetDate ?? '—',
    },
    {
      id: 'actions',
      header: t('operations:purchasing.list.columns.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original
        const label = order.reference || order.referenceInt || order.uuid
        return (
          <Link
            {...organizationLocation(
              organizationSlug,
              order.branchUuid,
              '/purchasing/$orderId',
              { orderId: order.uuid }
            )}
            aria-label={t('operations:purchasing.list.detailsLabel', { label })}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:purchasing.list.details')}
          </Link>
        )
      },
    },
  ]
}

type OrdersDirectoryProps = {
  /**
   * Fixed supplier context. When set, the list only reads that supplier's
   * orders, defaults to every status, and creation cannot pick another
   * supplier. Callers gate and key this component by supplier uuid so a new
   * supplier starts from fresh page, search, and form state.
   */
  supplier?: PurchaseOrderSupplier
  emptyMessage?: string
}

/**
 * Purchase order directory. Its filters and open create form are branch
 * context, so the inner directory remounts on branch transitions even inside
 * shells that keep their organization key (supplier detail).
 */
export function OrdersDirectory(props: OrdersDirectoryProps) {
  const branchUuid = useOptionalBranch()?.branch.uuid ?? null
  return <OrdersDirectoryContent key={branchUuid ?? 'company'} {...props} />
}

function OrdersDirectoryContent({
  supplier,
  emptyMessage = t('operations:purchasing.list.empty'),
}: OrdersDirectoryProps) {
  const organizationSlug = useOrganizationSlug()
  const branchContext = useOptionalBranch()
  const branch = branchContext?.branch ?? null
  const client = useQueryClient()
  const navigate = useNavigate()
  const openOnlyId = useId()
  const openOnlyLabelId = `${openOnlyId}-label`
  const originId = useId()
  const scope = organizationCacheScope()
  const supplierUuid = supplier?.uuid
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [openOnly, setOpenOnly] = useState(supplier === undefined)
  // The selected branch never hides company-origin orders permanently: a branch
  // context starts on its own origin, while the explicit Company and All filters
  // keep every shared company-origin order discoverable.
  const [origin, setOrigin] = useState<'all' | 'company' | 'branch'>(
    branch ? 'branch' : 'all'
  )
  const [creating, setCreating] = useState(false)
  // A branch-origin filter is only meaningful while that branch is selected.
  const effectiveOrigin = origin === 'branch' && branch ? 'branch' : origin
  const originBranchUuid =
    effectiveOrigin === 'branch' && branch ? branch.uuid : undefined
  const columns = useMemo(
    () => purchaseOrderColumns(organizationSlug),
    [organizationSlug]
  )
  const orders = useQuery({
    queryKey: [
      'purchasing',
      scope,
      'list',
      supplierUuid ?? null,
      page,
      search,
      openOnly,
      effectiveOrigin,
      originBranchUuid ?? null,
    ],
    queryFn: () =>
      purchasingApi.orders({
        page,
        search,
        open: openOnly,
        supplierUuid,
        branchUuid: originBranchUuid,
        company: effectiveOrigin === 'company' ? true : undefined,
      }),
  })
  const creation = useMutation({
    mutationFn: (input: { body: OrderInput; captured: CapturedBranchScope }) =>
      purchasingApi.createOrder(input.body),
    onSuccess: async (created, input) => {
      // Creation is not aborted by a branch switch (company client), so the
      // settlement only touches the company caches it was captured against and
      // never closes, toasts, or navigates the newly selected branch's UI.
      await client.invalidateQueries({
        queryKey: ['purchasing', input.captured.organizationScope],
      })
      // Creation writes the finance reservation of the new order.
      await client.invalidateQueries({
        queryKey: ['finance', input.captured.organizationScope],
      })
      if (!isBranchScopeCurrent(input.captured)) return
      setCreating(false)
      toast.success(t('operations:purchasing.list.created'))
      await navigate(
        // The created order's own origin decides the destination scope: a
        // company-origin order opens on the company path, never a branch path.
        organizationLocation(
          organizationSlug,
          created.branchUuid,
          '/purchasing/$orderId',
          { orderId: created.uuid }
        )
      )
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.captured))
        toast.error(errorMessage(caught))
    },
  })
  const data = orders.data
  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button
          type='button'
          onClick={() => {
            creation.reset()
            setCreating(true)
          }}
        >
          {t('operations:purchasing.list.create')}
        </Button>
      </div>
      <form
        className='flex flex-wrap items-center gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSearch(draft)
        }}
      >
        <Input
          aria-label={t('operations:purchasing.list.searchLabel')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('operations:purchasing.list.searchPlaceholder')}
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>{t('operations:common.find')}</Button>
        <div className='flex items-center gap-2'>
          <Checkbox
            id={openOnlyId}
            aria-labelledby={openOnlyLabelId}
            checked={openOnly}
            onCheckedChange={(value) => {
              setOpenOnly(value === true)
              setPage(0)
            }}
          />
          <Label
            id={openOnlyLabelId}
            htmlFor={openOnlyId}
            className='font-normal'
          >
            {t('operations:purchasing.list.openOnly')}
          </Label>
        </div>
        <div className='flex items-center gap-2'>
          <Label htmlFor={originId} className='font-normal'>
            {t('operations:purchasing.list.origin')}
          </Label>
          <Select
            value={effectiveOrigin}
            onValueChange={(value) => {
              setOrigin(value as 'all' | 'company' | 'branch')
              setPage(0)
            }}
          >
            <SelectTrigger id={originId} className='w-52'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>
                {t('operations:purchasing.list.originAll')}
              </SelectItem>
              <SelectItem value='company'>
                {t('operations:purchasing.list.originCompany')}
              </SelectItem>
              {branch && (
                <SelectItem value='branch'>
                  {t('operations:purchasing.list.originBranch', {
                    branch: branch.name,
                  })}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </form>
      <p className='text-sm text-muted-foreground'>
        {branch
          ? t('operations:purchasing.list.originBranchDefaultHint')
          : t('operations:purchasing.list.originCompanyHint')}
      </p>
      {orders.isPending && (
        <p role='status'>{t('operations:purchasing.list.loading')}</p>
      )}
      {orders.isError && (
        <p role='alert'>
          {errorMessage(orders.error)}{' '}
          <Button variant='outline' onClick={() => void orders.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('operations:purchasing.list.total', { count: data.total })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('operations:purchasing.list.openHint')}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('operations:purchasing.list.currencyHint')}
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(order) => order.uuid}
            caption={t('operations:purchasing.list.caption')}
            emptyMessage={emptyMessage}
          />
        </>
      )}
      <PageControls
        page={page}
        loading={orders.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {creating && (
        <PurchaseOrderForm
          pending={creation.isPending}
          error={creation.error}
          fixedSupplier={supplier}
          branch={branch}
          onClose={() => setCreating(false)}
          onSubmit={(body) =>
            creation.mutate({
              body,
              captured: captureBranchScope(branch?.uuid ?? null),
            })
          }
        />
      )}
    </div>
  )
}
