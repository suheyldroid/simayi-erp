import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { locale, t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationResourceParams,
  useOrganizationScope,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, financeApi } from './api'
import { movementKindLabel, movementStatusLabel } from './model'

export function MoneyMovementDetail() {
  const { movementId } = useOrganizationResourceParams()
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const uuid = movementId === undefined ? null : parseResourceUuid(movementId)
  const [reversing, setReversing] = useState(false)
  const movement = useQuery({
    queryKey: ['finance', scope, 'detail', uuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
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
        // A sale receipt reversal touches the original sale in its own branch;
        // branch scopes live under the same prefix.
        client.invalidateQueries({ queryKey: ['sales'] }),
      ])
      toast.success(t('operations:finance.detail.reversed'))
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
            {...organizationLocation(organizationSlug, branchUuid, '/finance')}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:finance.detail.back')}
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !movement.isError
              ? movementKindLabel(record.kind)
              : t('operations:finance.detail.title')}
          </h1>
        </div>
        {uuid === null && (
          <p role='alert'>{t('operations:finance.detail.notFound')}</p>
        )}
        {uuid !== null && movement.isPending && (
          <p role='status'>{t('operations:finance.detail.loading')}</p>
        )}
        {uuid !== null && movement.isError && detailStatus === 404 && (
          <p role='alert'>{t('operations:finance.detail.notFound')}</p>
        )}
        {uuid !== null && movement.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(movement.error)}{' '}
            <Button variant='outline' onClick={() => void movement.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}
        {record && !movement.isError && (
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <h2 className='text-xl font-semibold'>
                {t('operations:finance.detail.sectionTitle')}
              </h2>
              {reversible && (
                <Button
                  type='button'
                  variant='destructive'
                  onClick={() => {
                    reversal.reset()
                    setReversing(true)
                  }}
                >
                  {t('operations:finance.detail.reverse')}
                </Button>
              )}
            </div>
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>{t('operations:finance.detail.fields.type')}</dt>
              <dd>{movementKindLabel(record.kind)}</dd>
              <dt>{t('operations:finance.detail.fields.amount')}</dt>
              <dd>
                {record.amount} {record.currencyCode}
              </dd>
              <dt>{t('operations:finance.detail.fields.date')}</dt>
              <dd>{record.occurredAt}</dd>
              <dt>{t('operations:finance.detail.fields.note')}</dt>
              <dd>{record.note || '—'}</dd>
              <dt>{t('operations:finance.detail.fields.status')}</dt>
              <dd>{movementStatusLabel(record)}</dd>
              {record.status === 'on_hold' && (
                <>
                  <dt>{t('operations:finance.detail.fields.reservation')}</dt>
                  <dd>{t('operations:finance.detail.reservationHint')}</dd>
                </>
              )}
              {record.pricingIncomplete && record.status === 'on_hold' && (
                <>
                  <dt>
                    {t('operations:finance.detail.fields.pendingPricing')}
                  </dt>
                  <dd>
                    {record.pricingIssueCount === 0
                      ? t('operations:finance.detail.pricingZero')
                      : t('operations:finance.detail.pricingIssues', {
                          count: record.pricingIssueCount,
                        })}
                  </dd>
                </>
              )}
              {record.purchaseOrderUuid != null && (
                <>
                  <dt>{t('operations:finance.detail.fields.purchaseOrder')}</dt>
                  <dd>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        record.branchUuid,
                        '/purchasing/$orderId',
                        { orderId: record.purchaseOrderUuid }
                      )}
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
                  <dt>{t('operations:finance.detail.fields.reverses')}</dt>
                  <dd>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        branchUuid,
                        '/finance/$movementId',
                        { movementId: record.reversalOfUuid }
                      )}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {t('operations:finance.detail.originalEntry')}
                    </Link>
                  </dd>
                </>
              )}
              {record.supplierUuid != null && (
                <>
                  <dt>{t('operations:finance.detail.fields.supplier')}</dt>
                  <dd>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        branchUuid,
                        '/supplier/$supplierId',
                        { supplierId: record.supplierUuid }
                      )}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.supplierName ?? record.supplierUuid}
                    </Link>
                  </dd>
                </>
              )}
              {record.saleUuid != null && (
                <>
                  <dt>{t('operations:finance.detail.fields.sale')}</dt>
                  <dd>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        record.branchUuid,
                        '/sales/$saleId',
                        { saleId: record.saleUuid }
                      )}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.saleReference ?? record.saleUuid}
                    </Link>
                  </dd>
                </>
              )}
              <dt>{t('operations:finance.detail.fields.sourceBranch')}</dt>
              <dd>
                {record.branchName ??
                  (record.branchUuid
                    ? record.branchUuid
                    : t('operations:finance.detail.companyWideEntry'))}
              </dd>
              <dt>{t('operations:finance.detail.fields.recorded')}</dt>
              <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
            </dl>
            <p className='text-sm text-muted-foreground'>
              {t('operations:finance.detail.hint')}
            </p>
          </section>
        )}
      </Main>
      <ConfirmDialog
        open={reversing && reversible}
        onOpenChange={(open) => {
          if (!open && reversal.isPending) return
          if (!open) setReversing(false)
        }}
        title={t('operations:finance.detail.reversalTitle')}
        desc={t('operations:finance.detail.reversalDescription')}
        cancelBtnText={t('operations:finance.detail.keepEntry')}
        confirmText={t('operations:finance.detail.reverse')}
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
