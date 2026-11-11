import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, purchasingApi } from '../api'
import type { OrderInput, PurchaseOrder } from '../model'
import { PurchaseOrderForm, type PurchaseOrderSupplier } from './order-create'

function purchaseOrderColumns(
  organizationSlug: string
): SortableColumn<PurchaseOrder>[] {
  return [
    {
      id: 'reference',
      header: 'Reference',
      accessorFn: (order) => order.reference || order.referenceInt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'supplier',
      header: 'Supplier',
      accessorFn: (order) => order.supplier?.name ?? '',
      cell: ({ row }) => row.original.supplier?.name ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (order) => order.statusLabel,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'total',
      header: 'Total',
      accessorFn: (order) => order.totalPrice ?? '',
      cell: ({ row }) => row.original.totalPrice ?? '—',
    },
    {
      id: 'target',
      header: 'Target',
      accessorFn: (order) => order.targetDate ?? '',
      cell: ({ row }) => row.original.targetDate ?? '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original
        const label = order.reference || order.referenceInt || order.uuid
        return (
          <Link
            to='/o/$organizationSlug/purchasing/$orderId'
            params={{ organizationSlug, orderId: order.uuid }}
            aria-label={`Details for purchase order ${label}`}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        )
      },
    },
  ]
}

export function OrdersDirectory({
  supplier,
  emptyMessage = 'No purchase orders match these filters.',
}: {
  /**
   * Fixed supplier context. When set, the list only reads that supplier's
   * orders, defaults to every status, and creation cannot pick another
   * supplier. Callers gate and key this component by supplier uuid so a new
   * supplier starts from fresh page, search, and form state.
   */
  supplier?: PurchaseOrderSupplier
  emptyMessage?: string
}) {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const openOnlyId = useId()
  const openOnlyLabelId = `${openOnlyId}-label`
  const scope = organizationCacheScope()
  const supplierUuid = supplier?.uuid
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [openOnly, setOpenOnly] = useState(supplier === undefined)
  const [creating, setCreating] = useState(false)
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
    ],
    queryFn: () =>
      purchasingApi.orders({ page, search, open: openOnly, supplierUuid }),
  })
  const creation = useMutation({
    mutationFn: (body: OrderInput) => purchasingApi.createOrder(body),
    onSuccess: async (created) => {
      setCreating(false)
      await client.invalidateQueries({ queryKey: ['purchasing', scope] })
      toast.success('Purchase order created')
      await navigate({
        to: '/o/$organizationSlug/purchasing/$orderId',
        params: { organizationSlug, orderId: created.uuid },
      })
    },
    onError: (caught) => toast.error(errorMessage(caught)),
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
          Create purchase order
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
          aria-label='Search purchase orders'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder='Search reference or supplier'
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>Find</Button>
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
            Open orders
          </Label>
        </div>
      </form>
      {orders.isPending && <p role='status'>Loading purchase orders…</p>}
      {orders.isError && (
        <p role='alert'>
          {errorMessage(orders.error)}{' '}
          <Button variant='outline' onClick={() => void orders.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {data.total} purchase orders. Sorting applies to this page only.
          </p>
          <p className='text-sm text-muted-foreground'>
            Select Details on an order to open it.
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(order) => order.uuid}
            caption='Purchase orders'
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
          onClose={() => setCreating(false)}
          onSubmit={(body) => creation.mutate(body)}
        />
      )}
    </div>
  )
}
