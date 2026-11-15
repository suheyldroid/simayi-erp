import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, financeApi } from './api'
import { movementKindLabel, movementStatusLabel } from './model'

const movementRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/finance/$movementId'
)

export function MoneyMovementDetail() {
  const { movementId } = movementRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const uuid = parseResourceUuid(movementId)
  const [reversing, setReversing] = useState(false)
  const movement = useQuery({
    queryKey: ['finance', scope, 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Money movement uuid is required')
      return financeApi.movement(uuid)
    },
    enabled: uuid !== null,
  })
  const reversal = useMutation({
    mutationFn: (target: string) => financeApi.reverse(target),
    onSuccess: async () => {
      setReversing(false)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['finance', scope] }),
        client.invalidateQueries({ queryKey: ['supplier-ledger', scope] }),
        client.invalidateQueries({ queryKey: ['sales', scope] }),
      ])
      toast.success('Entry reversed')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const detailStatus =
    movement.error && axios.isAxiosError(movement.error)
      ? movement.error.response?.status
      : undefined
  const record = movement.data
  const reversible = record?.reversible === true
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/finance'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to finance
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !movement.isError
              ? movementKindLabel(record.kind)
              : 'Money movement'}
          </h1>
        </div>
        {uuid === null && <p role='alert'>Money movement not found.</p>}
        {uuid !== null && movement.isPending && (
          <p role='status'>Loading money movement…</p>
        )}
        {uuid !== null && movement.isError && detailStatus === 404 && (
          <p role='alert'>Money movement not found.</p>
        )}
        {uuid !== null && movement.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(movement.error)}{' '}
            <Button variant='outline' onClick={() => void movement.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {record && !movement.isError && (
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <h2 className='text-xl font-semibold'>Entry</h2>
              {reversible && (
                <Button
                  type='button'
                  variant='destructive'
                  onClick={() => {
                    reversal.reset()
                    setReversing(true)
                  }}
                >
                  Reverse entry
                </Button>
              )}
            </div>
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>Type</dt>
              <dd>{movementKindLabel(record.kind)}</dd>
              <dt>Amount</dt>
              <dd>
                {record.amount} {record.currencyCode}
              </dd>
              <dt>Date</dt>
              <dd>{record.occurredAt}</dd>
              <dt>Note</dt>
              <dd>{record.note || '—'}</dd>
              <dt>Status</dt>
              <dd>{movementStatusLabel(record)}</dd>
              {record.status === 'on_hold' && (
                <>
                  <dt>Reservation</dt>
                  <dd>
                    This amount is held against the cash balance but not
                    debited. Completing the purchase order posts the exact cash
                    outflow once; cancelling it releases the hold.
                  </dd>
                </>
              )}
              {record.pricingIncomplete && record.status === 'on_hold' && (
                <>
                  <dt>Pending pricing</dt>
                  <dd>
                    {record.pricingIssueCount === 0
                      ? 'The order has no priced line yet, so the hold is zero until its first price.'
                      : `${record.pricingIssueCount} line(s) have no price, no recorded currency, or another currency, so they are not part of the held amount.`}
                  </dd>
                </>
              )}
              {record.purchaseOrderUuid != null && (
                <>
                  <dt>Purchase order</dt>
                  <dd>
                    <Link
                      to='/o/$organizationSlug/purchasing/$orderId'
                      params={{
                        organizationSlug,
                        orderId: record.purchaseOrderUuid,
                      }}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.purchaseOrderReference ??
                        record.purchaseOrderUuid}
                    </Link>
                  </dd>
                </>
              )}
              {record.reversalOfUuid != null && (
                <>
                  <dt>Reverses</dt>
                  <dd>
                    <Link
                      to='/o/$organizationSlug/finance/$movementId'
                      params={{
                        organizationSlug,
                        movementId: record.reversalOfUuid,
                      }}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      Original entry
                    </Link>
                  </dd>
                </>
              )}
              {record.supplierUuid != null && (
                <>
                  <dt>Supplier</dt>
                  <dd>
                    <Link
                      to='/o/$organizationSlug/supplier/$supplierId'
                      params={{
                        organizationSlug,
                        supplierId: record.supplierUuid,
                      }}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.supplierName ?? record.supplierUuid}
                    </Link>
                  </dd>
                </>
              )}
              {record.saleUuid != null && (
                <>
                  <dt>Sale</dt>
                  <dd>
                    <Link
                      to='/o/$organizationSlug/sales/$saleId'
                      params={{
                        organizationSlug,
                        saleId: record.saleUuid,
                      }}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.saleReference ?? record.saleUuid}
                    </Link>
                  </dd>
                </>
              )}
              <dt>Recorded</dt>
              <dd>{new Date(record.createdAt).toLocaleString()}</dd>
            </dl>
          </section>
        )}
      </Main>
      <ConfirmDialog
        open={reversing && reversible}
        onOpenChange={(open) => {
          if (!open && reversal.isPending) return
          if (!open) setReversing(false)
        }}
        title='Reverse money entry'
        desc='Reversing posts one linked opposite entry and keeps the original immutable. This cannot be undone or repeated.'
        cancelBtnText='Keep entry'
        confirmText='Reverse entry'
        destructive
        disabled={!record}
        isLoading={reversal.isPending}
        handleConfirm={() => {
          if (record) reversal.mutate(record.uuid)
        }}
      >
        {reversal.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {errorMessage(reversal.error)}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
