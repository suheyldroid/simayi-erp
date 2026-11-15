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
import { currencyApi } from '@/features/currency/api'
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
  const preference = useQuery({
    queryKey: ['system-preference'],
    queryFn: () => currencyApi.preference(),
  })
  const record = order.data
  const action = useMutation({
    mutationFn: (input: {
      name: 'place' | 'hold' | 'complete'
      acceptIncomplete?: boolean
      scope: string
    }) => {
      if (!order.data) throw new Error('Purchase order is not loaded')
      return purchasingApi.act(order.data.uuid, input.name, {
        version: order.data.version,
        acceptIncomplete: input.acceptIncomplete,
      })
    },
    onSuccess: async (updated, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      // Completion turns the finance reservation into the exact cash purchase
      // and settles the supplier payable in the same order transaction.
      await client.invalidateQueries({
        queryKey: ['supplier-ledger', input.scope],
      })
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      toast.success(`Order is ${updated.statusLabel.toLowerCase()}`)
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const cancelMutation = useMutation({
    mutationFn: (target: { uuid: string; version: number; scope: string }) =>
      purchasingApi.act(target.uuid, 'cancel', { version: target.version }),
    onSuccess: async (updated, target) => {
      setCancelOpen(false)
      setCancelTarget(null)
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      // Cancelling releases the finance reservation and never debits cash.
      await client.invalidateQueries({ queryKey: ['finance', target.scope] })
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
  const receivedLines = lines.data?.items ?? []
  const receivedExtras = extras.data?.items ?? []
  const linesLoaded = lines.isSuccess && extras.isSuccess
  const effectiveCurrency = preference.data?.defaultCurrencyCode ?? null
  // Every amount is labelled from its own line snapshot; nothing is assumed
  // from the current system currency when lines disagree or predate it.
  const pricedCurrencies = new Set<string>()
  let unknownCurrency = false
  for (const line of receivedLines) {
    if (line.purchasePrice === null) continue
    if (line.currencyCode === null) unknownCurrency = true
    else pricedCurrencies.add(line.currencyCode)
  }
  for (const extra of receivedExtras) {
    if (extra.price === null) continue
    if (extra.currencyCode === null) unknownCurrency = true
    else pricedCurrencies.add(extra.currencyCode)
  }
  const mixedCurrency = pricedCurrencies.size > 1
  const singleCurrency =
    !unknownCurrency && pricedCurrencies.size === 1
      ? [...pricedCurrencies][0]
      : null
  const totalCurrencyNote =
    lines.isError || extras.isError
      ? ' · line currency unavailable'
      : !linesLoaded
        ? ' · loading line currencies…'
        : mixedCurrency
          ? ' · mixed line currencies'
          : unknownCurrency
            ? ' · unknown legacy currency'
            : ''
  const requirements = [
    {
      label: 'A supplier is assigned',
      met: record?.supplierUuid != null,
    },
    {
      label: `The system currency is configured${
        effectiveCurrency ? ` (${effectiveCurrency})` : ''
      }`,
      met: effectiveCurrency !== null,
    },
    {
      label: 'At least one item or extra line exists',
      met: receivedLines.length + receivedExtras.length > 0,
    },
    {
      label: 'Every item and extra line has a price',
      met:
        linesLoaded &&
        receivedLines.every((line) => line.purchasePrice !== null) &&
        receivedExtras.every((extra) => extra.price !== null),
    },
    {
      label: `Every line price is in the system currency${
        effectiveCurrency ? ` (${effectiveCurrency})` : ''
      }`,
      met:
        linesLoaded &&
        !unknownCurrency &&
        !mixedCurrency &&
        pricedCurrencies.size > 0 &&
        [...pricedCurrencies].every((code) => code === effectiveCurrency),
    },
    {
      label: 'All lines are received, or the incomplete completion is checked',
      met:
        linesLoaded &&
        (receivedLines.every(
          (line) =>
            !isPositiveDecimal(
              subtractDecimalStrings(line.quantity, line.received)
            )
        ) ||
          acceptIncomplete),
    },
  ]
  const completable = requirements.every((requirement) => requirement.met)
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
    cancelMutation.mutate({
      uuid: cancelTarget.uuid,
      version: cancelTarget.version,
      scope: organizationCacheScope(),
    })
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
                <dd>
                  {record.totalPrice == null
                    ? '—'
                    : `${record.totalPrice}${singleCurrency ? ` ${singleCurrency}` : ''}`}
                  {record.totalPrice == null ? '' : totalCurrencyNote}
                </dd>
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
                    onClick={() =>
                      action.mutate({
                        name: 'place',
                        scope: organizationCacheScope(),
                      })
                    }
                  >
                    Place
                  </Button>
                )}
                {(record.status === 10 || record.status === 20) && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        name: 'hold',
                        scope: organizationCacheScope(),
                      })
                    }
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
                    disabled={action.isPending || !completable}
                    onClick={() =>
                      action.mutate({
                        name: 'complete',
                        acceptIncomplete,
                        scope: organizationCacheScope(),
                      })
                    }
                  >
                    Complete
                  </Button>
                )}
              </div>
              {record.status === 20 && (
                <div className='space-y-2 rounded-md border border-border p-3'>
                  <h3 className='text-sm font-medium'>
                    Completion requirements
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    An open order holds its known priced lines in finance
                    without debiting cash. Completion is the only purchase
                    transition that turns that hold into the exact cash purchase
                    and settles the supplier payable; the final total is every
                    priced item and extra line, all in the fixed system
                    currency.
                  </p>
                  <ul className='space-y-1 text-sm'>
                    {requirements.map((requirement) => (
                      <li key={requirement.label} className='flex gap-2'>
                        <span
                          className={
                            requirement.met
                              ? 'text-muted-foreground'
                              : 'text-destructive'
                          }
                        >
                          {requirement.met ? 'Ready' : 'Missing'}
                        </span>
                        <span>{requirement.label}</span>
                      </li>
                    ))}
                  </ul>
                  {preference.isError && (
                    <p role='alert' className='text-sm text-destructive'>
                      Could not load the system currency.{' '}
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => void preference.refetch()}
                      >
                        Retry
                      </Button>
                    </p>
                  )}
                  {!linesLoaded && (
                    <p className='text-sm text-muted-foreground'>
                      Load the item and extra lines to evaluate the price and
                      receipt requirements.
                    </p>
                  )}
                </div>
              )}
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
              systemCurrency={effectiveCurrency}
              pending={lines.isPending}
              error={lines.isError ? lines.error : null}
              editable={isOpen}
              onRetry={() => void lines.refetch()}
            />
            <OrderExtras
              order={record}
              extras={extras.data?.items ?? []}
              systemCurrency={effectiveCurrency}
              pending={extras.isPending}
              error={extras.isError ? extras.error : null}
              editable={isOpen}
              onRetry={() => void extras.refetch()}
            />
            {record.status === 20 && lines.data && (
              <OrderReceive order={record} lines={lines.data.items} />
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
