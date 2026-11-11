import { useId, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { isPositiveDecimal, subtractDecimalStrings } from '@/lib/decimal-string'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, purchasingApi } from './api'
import { OrderExtras } from './components/order-extras'
import { OrderLines } from './components/order-lines'
import { OrderReceive } from './components/order-receive'

const orderRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/purchasing/$orderId'
)

export function PurchaseOrderDetail() {
  const { orderId } = orderRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const uuid = parseResourceUuid(orderId)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<{
    uuid: string
    version: number
    reference: string
  } | null>(null)
  const [acceptIncomplete, setAcceptIncomplete] = useState(false)
  const acceptIncompleteId = useId()
  const acceptIncompleteLabelId = `${acceptIncompleteId}-label`
  const client = useQueryClient()
  const order = useQuery({
    queryKey: ['purchasing', organizationCacheScope(), 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Purchase order uuid is required')
      return purchasingApi.order(uuid)
    },
    enabled: uuid !== null,
  })
  const lines = useQuery({
    queryKey: ['purchasing', organizationCacheScope(), 'lines', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Purchase order uuid is required')
      return purchasingApi.lines(uuid)
    },
    enabled: uuid !== null,
  })
  const extras = useQuery({
    queryKey: ['purchasing', organizationCacheScope(), 'extras', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Purchase order uuid is required')
      return purchasingApi.extras(uuid)
    },
    enabled: uuid !== null,
  })
  const record = order.data
  const action = useMutation({
    mutationFn: (input: {
      name: 'place' | 'hold' | 'complete'
      acceptIncomplete?: boolean
    }) => {
      if (!order.data) throw new Error('Purchase order is not loaded')
      return purchasingApi.act(order.data.uuid, input.name, {
        version: order.data.version,
        acceptIncomplete: input.acceptIncomplete,
      })
    },
    onSuccess: async (updated) => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      toast.success(`Order is ${updated.statusLabel.toLowerCase()}`)
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const cancelMutation = useMutation({
    mutationFn: (target: { uuid: string; version: number }) =>
      purchasingApi.act(target.uuid, 'cancel', { version: target.version }),
    onSuccess: async (updated) => {
      setCancelOpen(false)
      setCancelTarget(null)
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      toast.success(`Order is ${updated.statusLabel.toLowerCase()}`)
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const detailStatus =
    order.error && axios.isAxiosError(order.error)
      ? order.error.response?.status
      : undefined
  const isOpen =
    record?.status === 10 || record?.status === 20 || record?.status === 25
  const cancelDialogOpen =
    cancelOpen &&
    cancelTarget !== null &&
    cancelTarget.uuid === uuid &&
    !order.isError
  const confirmCancel = () => {
    if (cancelMutation.isPending) return
    if (cancelTarget === null || cancelTarget.uuid !== uuid || order.isError) {
      setCancelOpen(false)
      return
    }
    cancelMutation.mutate(cancelTarget)
  }
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/purchasing'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to purchasing
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !order.isError
              ? `Purchase order ${record.reference || record.referenceInt}`
              : 'Purchase order'}
          </h1>
        </div>
        {uuid === null && <p role='alert'>Purchase order not found.</p>}
        {uuid !== null && order.isPending && (
          <p role='status'>Loading purchase order…</p>
        )}
        {uuid !== null && order.isError && detailStatus === 404 && (
          <p role='alert'>Purchase order not found.</p>
        )}
        {uuid !== null && order.isError && detailStatus !== 404 && (
          <p role='alert'>
            Could not load this purchase order.{' '}
            <Button variant='outline' onClick={() => void order.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {record && !order.isError && (
          <>
            <section className='space-y-4 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>Order details</h2>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>Reference</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>Status</dt>
                <dd>{record.statusLabel}</dd>
                <dt>Supplier</dt>
                <dd>{record.supplier?.name ?? '—'}</dd>
                {record.supplier && (
                  <>
                    <dt>Supplier contact</dt>
                    <dd>
                      {[
                        record.supplier.contact,
                        record.supplier.contactPhone,
                        record.supplier.contactRole,
                      ]
                        .filter((value) => value !== '')
                        .join(' · ') || '—'}
                    </dd>
                    <dt>Supplier address</dt>
                    <dd>
                      {[
                        record.supplier.line1,
                        record.supplier.line2,
                        [record.supplier.postalCode, record.supplier.postalCity]
                          .filter(Boolean)
                          .join(' '),
                        record.supplier.province,
                        record.supplier.country,
                      ]
                        .filter((value) => value !== '')
                        .join(', ') || '—'}
                    </dd>
                  </>
                )}
                <dt>Supplier reference</dt>
                <dd>{record.supplierReference || '—'}</dd>
                <dt>Description</dt>
                <dd>{record.description || '—'}</dd>
                <dt>Total</dt>
                <dd>{record.totalPrice ?? '—'}</dd>
                <dt>Target date</dt>
                <dd>{record.targetDate ?? '—'}</dd>
                <dt>Creation date</dt>
                <dd>{record.creationDate ?? '—'}</dd>
                <dt>Issue date</dt>
                <dd>{record.issueDate ?? '—'}</dd>
                <dt>Complete date</dt>
                <dd>{record.completeDate ?? '—'}</dd>
                <dt>Version</dt>
                <dd>{record.version}</dd>
              </dl>
            </section>
            <section className='space-y-3'>
              <h2 className='text-xl font-semibold'>Order actions</h2>
              <div className='flex flex-wrap gap-2'>
                {(record.status === 10 || record.status === 25) && (
                  <Button
                    type='button'
                    disabled={action.isPending}
                    onClick={() => action.mutate({ name: 'place' })}
                  >
                    Place
                  </Button>
                )}
                {(record.status === 10 || record.status === 20) && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={action.isPending}
                    onClick={() => action.mutate({ name: 'hold' })}
                  >
                    Hold
                  </Button>
                )}
                {isOpen && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={action.isPending || cancelMutation.isPending}
                    onClick={() => {
                      cancelMutation.reset()
                      setCancelTarget({
                        uuid: record.uuid,
                        version: record.version,
                        reference:
                          record.reference ||
                          record.referenceInt ||
                          'this purchase order',
                      })
                      setCancelOpen(true)
                    }}
                  >
                    Cancel
                  </Button>
                )}
                {record.status === 20 && (
                  <Button
                    type='button'
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ name: 'complete', acceptIncomplete })
                    }
                  >
                    Complete
                  </Button>
                )}
              </div>
              {record.status === 20 && (
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id={acceptIncompleteId}
                    aria-labelledby={acceptIncompleteLabelId}
                    checked={acceptIncomplete}
                    onCheckedChange={(value) =>
                      setAcceptIncomplete(value === true)
                    }
                  />
                  <Label
                    id={acceptIncompleteLabelId}
                    htmlFor={acceptIncompleteId}
                    className='text-sm leading-snug font-normal'
                  >
                    Complete even when lines are not fully received
                  </Label>
                </div>
              )}
            </section>
            <OrderLines
              order={record}
              lines={lines.data?.items ?? []}
              pending={lines.isPending}
              error={lines.isError ? lines.error : null}
              editable={isOpen}
              onRetry={() => void lines.refetch()}
            />
            <OrderExtras
              order={record}
              extras={extras.data?.items ?? []}
              pending={extras.isPending}
              error={extras.isError ? extras.error : null}
              editable={isOpen}
              onRetry={() => void extras.refetch()}
            />
            {record.status === 20 && (
              <OrderReceive
                order={record}
                lines={(lines.data?.items ?? []).filter((line) =>
                  isPositiveDecimal(
                    subtractDecimalStrings(line.quantity, line.received)
                  )
                )}
              />
            )}
          </>
        )}
      </Main>
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          if (!open && cancelMutation.isPending) return
          if (!open) setCancelTarget(null)
          setCancelOpen(open)
        }}
        title='Cancel purchase order'
        desc={`Cancel ${cancelTarget?.reference ?? 'this purchase order'}? Cancelling keeps the order, its lines and received stock as history. A cancelled order cannot be placed or completed again.`}
        cancelBtnText='Keep order'
        confirmText='Cancel order'
        destructive
        disabled={cancelTarget === null}
        isLoading={cancelMutation.isPending}
        handleConfirm={confirmCancel}
      >
        {cancelMutation.isError && (
          <p role='alert' className='text-destructive'>
            {errorMessage(cancelMutation.error)}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
