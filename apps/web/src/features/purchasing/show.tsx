import { useId, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { isPositiveDecimal, subtractDecimalStrings } from '@/lib/decimal-string'
import { t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationResourceParams,
} from '@/lib/organization-navigation'
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
import { OrderReceipts } from './components/order-receipts'
import { OrderReceive } from './components/order-receive'
import { purchaseOrderStatusLabel } from './model'

export function PurchaseOrderDetail() {
  const { orderId, organizationSlug, branchUuid } =
    useOrganizationResourceParams()
  const uuid = parseResourceUuid(orderId ?? '')
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
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return purchasingApi.order(uuid)
    },
    enabled: uuid !== null,
  })
  const lines = useQuery({
    queryKey: ['purchasing', organizationCacheScope(), 'lines', uuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return purchasingApi.lines(uuid)
    },
    enabled: uuid !== null,
  })
  const extras = useQuery({
    queryKey: ['purchasing', organizationCacheScope(), 'extras', uuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
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
      ui: CapturedBranchScope
    }) => {
      if (!order.data) throw new Error(t('operations:common.errors.notLoaded'))
      return purchasingApi.act(order.data.uuid, input.name, {
        version: order.data.version,
        acceptIncomplete: input.acceptIncomplete,
      })
    },
    onSuccess: async (updated, input) => {
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      // Completion turns the finance reservation into the exact cash purchase
      // and settles the supplier payable in the same order transaction.
      await client.invalidateQueries({
        queryKey: ['supplier-ledger', input.scope],
      })
      await client.invalidateQueries({ queryKey: ['finance', input.scope] })
      if (!isBranchScopeCurrent(input.ui)) return
      toast.success(
        t('operations:purchasing.detail.statusToast', {
          status: purchaseOrderStatusLabel(updated.status),
        })
      )
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  const cancelMutation = useMutation({
    mutationFn: (target: {
      uuid: string
      version: number
      scope: string
      ui: CapturedBranchScope
    }) => purchasingApi.act(target.uuid, 'cancel', { version: target.version }),
    onSuccess: async (updated, target) => {
      await client.invalidateQueries({ queryKey: ['purchasing', target.scope] })
      // Cancelling releases the finance reservation and never debits cash.
      await client.invalidateQueries({ queryKey: ['finance', target.scope] })
      if (!isBranchScopeCurrent(target.ui)) return
      setCancelOpen(false)
      setCancelTarget(null)
      toast.success(
        t('operations:purchasing.detail.statusToast', {
          status: purchaseOrderStatusLabel(updated.status),
        })
      )
    },
    onError: (caught, target) => {
      if (isBranchScopeCurrent(target.ui)) toast.error(errorMessage(caught))
    },
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
      ? t('operations:purchasing.detail.currencyNoteUnavailable')
      : !linesLoaded
        ? t('operations:purchasing.detail.currencyNoteLoading')
        : mixedCurrency
          ? t('operations:purchasing.detail.currencyNoteMixed')
          : unknownCurrency
            ? t('operations:purchasing.detail.currencyNoteLegacy')
            : ''
  const requirements = [
    {
      label: t('operations:purchasing.detail.requirements.supplier'),
      met: record?.supplierUuid != null,
    },
    {
      label: effectiveCurrency
        ? t('operations:purchasing.detail.requirements.currencyWithCode', {
            currency: effectiveCurrency,
          })
        : t('operations:purchasing.detail.requirements.currency'),
      met: effectiveCurrency !== null,
    },
    {
      label: t('operations:purchasing.detail.requirements.lines'),
      met: receivedLines.length + receivedExtras.length > 0,
    },
    {
      label: t('operations:purchasing.detail.requirements.prices'),
      met:
        linesLoaded &&
        receivedLines.every((line) => line.purchasePrice !== null) &&
        receivedExtras.every((extra) => extra.price !== null),
    },
    {
      label: effectiveCurrency
        ? t('operations:purchasing.detail.requirements.currencyMatchWithCode', {
            currency: effectiveCurrency,
          })
        : t('operations:purchasing.detail.requirements.currencyMatch'),
      met:
        linesLoaded &&
        !unknownCurrency &&
        !mixedCurrency &&
        pricedCurrencies.size > 0 &&
        [...pricedCurrencies].every((code) => code === effectiveCurrency),
    },
    {
      label: t('operations:purchasing.detail.requirements.received'),
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
      ui: captureBranchScope(branchUuid),
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
            {...organizationLocation(
              organizationSlug,
              branchUuid,
              '/purchasing'
            )}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:purchasing.detail.back')}
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !order.isError
              ? t('operations:purchasing.detail.titleWithReference', {
                  reference: record.reference || record.referenceInt,
                })
              : t('operations:purchasing.detail.title')}
          </h1>
        </div>
        {uuid === null && (
          <p role='alert'>{t('operations:purchasing.detail.notFound')}</p>
        )}
        {uuid !== null && order.isPending && (
          <p role='status'>{t('operations:purchasing.detail.loading')}</p>
        )}
        {uuid !== null && order.isError && detailStatus === 404 && (
          <p role='alert'>{t('operations:purchasing.detail.notFound')}</p>
        )}
        {uuid !== null && order.isError && detailStatus !== 404 && (
          <p role='alert'>
            {t('operations:purchasing.detail.loadError')}{' '}
            <Button variant='outline' onClick={() => void order.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}
        {record && !order.isError && (
          <>
            <section className='space-y-4 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>
                {t('operations:purchasing.detail.sectionTitle')}
              </h2>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>{t('operations:purchasing.detail.fields.reference')}</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.origin')}</dt>
                <dd>
                  {record.branch
                    ? `${record.branch.name}${
                        record.branch.active
                          ? ''
                          : t('operations:common.inactiveSuffix')
                      }`
                    : t('operations:purchasing.companyOrigin')}
                </dd>
                <dt>{t('operations:purchasing.detail.fields.status')}</dt>
                <dd>{purchaseOrderStatusLabel(record.status)}</dd>
                <dt>{t('operations:purchasing.detail.fields.supplier')}</dt>
                <dd>{record.supplier?.name ?? '—'}</dd>
                {record.supplier && (
                  <>
                    <dt>
                      {t('operations:purchasing.detail.fields.supplierContact')}
                    </dt>
                    <dd>
                      {[
                        record.supplier.contact,
                        record.supplier.contactPhone,
                        record.supplier.contactRole,
                      ]
                        .filter((value) => value !== '')
                        .join(' · ') || '—'}
                    </dd>
                    <dt>
                      {t('operations:purchasing.detail.fields.supplierAddress')}
                    </dt>
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
                <dt>
                  {t('operations:purchasing.detail.fields.supplierReference')}
                </dt>
                <dd>{record.supplierReference || '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.description')}</dt>
                <dd>{record.description || '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.total')}</dt>
                <dd>
                  {record.totalPrice == null
                    ? '—'
                    : `${record.totalPrice}${singleCurrency ? ` ${singleCurrency}` : ''}`}
                  {record.totalPrice == null ? '' : totalCurrencyNote}
                </dd>
                <dt>{t('operations:purchasing.detail.fields.targetDate')}</dt>
                <dd>{record.targetDate ?? '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.creationDate')}</dt>
                <dd>{record.creationDate ?? '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.issueDate')}</dt>
                <dd>{record.issueDate ?? '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.completeDate')}</dt>
                <dd>{record.completeDate ?? '—'}</dd>
                <dt>{t('operations:purchasing.detail.fields.version')}</dt>
                <dd>{record.version}</dd>
              </dl>
            </section>
            <section className='space-y-3'>
              <h2 className='text-xl font-semibold'>
                {t('operations:purchasing.detail.actionsTitle')}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {(record.status === 10 || record.status === 25) && (
                  <Button
                    type='button'
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        name: 'place',
                        scope: organizationCacheScope(),
                        ui: captureBranchScope(branchUuid),
                      })
                    }
                  >
                    {t('operations:purchasing.detail.place')}
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
                        ui: captureBranchScope(branchUuid),
                      })
                    }
                  >
                    {t('operations:purchasing.detail.hold')}
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
                          t('operations:purchasing.detail.thisOrder'),
                      })
                      setCancelOpen(true)
                    }}
                  >
                    {t('operations:purchasing.detail.cancel')}
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
                        ui: captureBranchScope(branchUuid),
                      })
                    }
                  >
                    {t('operations:purchasing.detail.complete')}
                  </Button>
                )}
              </div>
              {record.status === 20 && (
                <div className='space-y-2 rounded-md border border-border p-3'>
                  <h3 className='text-sm font-medium'>
                    {t('operations:purchasing.detail.requirementsTitle')}
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    {t('operations:purchasing.detail.requirementsDescription')}
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
                          {requirement.met
                            ? t('operations:purchasing.detail.ready')
                            : t('operations:purchasing.detail.missing')}
                        </span>
                        <span>{requirement.label}</span>
                      </li>
                    ))}
                  </ul>
                  {preference.isError && (
                    <p role='alert' className='text-sm text-destructive'>
                      {t('operations:purchasing.detail.currencyLoadError')}{' '}
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => void preference.refetch()}
                      >
                        {t('operations:common.retry')}
                      </Button>
                    </p>
                  )}
                  {!linesLoaded && (
                    <p className='text-sm text-muted-foreground'>
                      {t('operations:purchasing.detail.loadLinesHint')}
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
                    {t('operations:purchasing.detail.acceptIncomplete')}
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
            <OrderReceipts order={record} lines={receivedLines} />
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
        title={t('operations:purchasing.detail.cancelTitle')}
        desc={t('operations:purchasing.detail.cancelDescription', {
          reference:
            cancelTarget?.reference ??
            t('operations:purchasing.detail.thisOrder'),
        })}
        cancelBtnText={t('operations:purchasing.detail.keepOrder')}
        confirmText={t('operations:purchasing.detail.cancelConfirm')}
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
