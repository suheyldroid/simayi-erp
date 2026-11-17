import { useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  errorMessage,
  financeApi,
  supplierLedgerApi,
} from '@/features/finance/api'
import { MoneyForm } from '@/features/finance/components/money-form'
import {
  supplierEntryKindLabel,
  type MoneyInput,
  type SupplierLedgerEntry,
} from '@/features/finance/model'
import { PageControls } from '@/features/users/components/page-controls'

export function SupplierLedgerPanel({
  supplierUuid,
  supplierName,
}: {
  supplierUuid: string
  supplierName: string
}) {
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const [page, setPage] = useState(0)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [reversalTarget, setReversalTarget] =
    useState<SupplierLedgerEntry | null>(null)
  const ledger = useQuery({
    queryKey: ['supplier-ledger', scope, 'list', supplierUuid, page],
    queryFn: () => supplierLedgerApi.ledger(supplierUuid, { page }),
  })
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['supplier-ledger', scope] }),
      client.invalidateQueries({ queryKey: ['finance', scope] }),
    ])
  }
  const payment = useMutation({
    mutationFn: (input: { body: MoneyInput; scope: string }) =>
      supplierLedgerApi.payment(supplierUuid, input.body),
    onSuccess: async (_entry, input) => {
      setPaymentOpen(false)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['supplier-ledger', input.scope],
        }),
        client.invalidateQueries({ queryKey: ['finance', input.scope] }),
      ])
      toast.success(t('operations:supplier.ledger.paymentRecorded'))
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const reversal = useMutation({
    mutationFn: (target: string) => financeApi.reverse(target),
    onSuccess: async () => {
      setReversalTarget(null)
      await invalidate()
      toast.success(t('operations:supplier.ledger.paymentReversed'))
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const data = ledger.data
  const pending = payment.isPending
  const activeError = payment.error
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>
            {t('operations:supplier.ledger.title')}
          </h2>
          <p className='text-sm text-muted-foreground'>
            {t('operations:supplier.ledger.description')}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            onClick={() => {
              payment.reset()
              setPaymentOpen(true)
            }}
          >
            {t('operations:supplier.ledger.recordPayment')}
          </Button>
        </div>
      </div>
      {ledger.isPending && (
        <p role='status'>{t('operations:supplier.ledger.loading')}</p>
      )}
      {ledger.isError && (
        <p role='alert'>
          {errorMessage(ledger.error)}{' '}
          <Button variant='outline' onClick={() => void ledger.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {data && !ledger.isError && (
        <>
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>{t('operations:supplier.ledger.fields.currency')}</dt>
            <dd>
              {data.currencyCode ??
                t('operations:supplier.ledger.notConfigured')}
            </dd>
            <dt>{t('operations:supplier.ledger.fields.outstanding')}</dt>
            <dd className='font-medium'>
              {`${data.outstanding} ${data.currencyCode ?? ''}`.trim()}
            </dd>
          </dl>
          {data.outstanding.startsWith('-') && (
            <p className='text-sm text-muted-foreground'>
              {t('operations:supplier.ledger.negativeBalance')}
            </p>
          )}
          <Table>
            <caption className='sr-only'>
              {t('operations:supplier.ledger.caption', {
                supplier: supplierName,
              })}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('operations:supplier.ledger.columns.date')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.type')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.amount')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.note')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.sourceBranch')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.reference')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.status')}
                </TableHead>
                <TableHead>
                  {t('operations:supplier.ledger.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((entry) => (
                <TableRow key={entry.uuid}>
                  <TableCell>{entry.occurredAt}</TableCell>
                  <TableCell>{supplierEntryKindLabel(entry.kind)}</TableCell>
                  <TableCell>
                    {entry.amount} {entry.currencyCode}
                  </TableCell>
                  <TableCell>{entry.note || '—'}</TableCell>
                  <TableCell>
                    {entry.branchName ??
                      t('operations:supplier.ledger.companyWide')}
                  </TableCell>
                  <TableCell>
                    {entry.purchaseOrderUuid != null ? (
                      <Link
                        {...organizationLocation(
                          organizationSlug,
                          entry.branchUuid,
                          '/purchasing/$orderId',
                          { orderId: entry.purchaseOrderUuid }
                        )}
                        className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                      >
                        {entry.purchaseOrderReference ??
                          t('operations:supplier.ledger.purchaseOrder')}
                      </Link>
                    ) : entry.moneyMovementUuid != null ? (
                      <Link
                        {...organizationLocation(
                          organizationSlug,
                          branchUuid,
                          '/finance/$movementId',
                          { movementId: entry.moneyMovementUuid }
                        )}
                        className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                      >
                        {t('operations:supplier.ledger.moneyMovement')}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.kind === 'reversal'
                      ? t('operations:supplier.ledger.reversal')
                      : entry.reversed
                        ? t('operations:supplier.ledger.reversed')
                        : t('operations:supplier.ledger.posted')}
                  </TableCell>
                  <TableCell>
                    {entry.kind === 'payment' &&
                    !entry.reversed &&
                    entry.moneyMovementUuid != null ? (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => {
                          reversal.reset()
                          setReversalTarget(entry)
                        }}
                      >
                        {t('operations:supplier.ledger.reverse')}
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    {t('operations:supplier.ledger.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            loading={ledger.isFetching}
            hasNext={(page + 1) * data.limit < data.total}
            onChange={setPage}
          />
        </>
      )}
      {paymentOpen && (
        <MoneyForm
          title={t('operations:supplier.ledger.paymentFormTitle')}
          description={t('operations:supplier.ledger.paymentFormDescription')}
          currencyCode={data?.currencyCode ?? null}
          submitLabel={t('operations:supplier.ledger.recordPayment')}
          pending={pending}
          error={activeError}
          onClose={() => {
            if (!pending) setPaymentOpen(false)
          }}
          onSubmit={(input) => {
            payment.mutate({ body: input, scope })
          }}
        />
      )}
      <ConfirmDialog
        open={reversalTarget !== null}
        onOpenChange={(open) => {
          if (!open && !reversal.isPending) {
            setReversalTarget(null)
            reversal.reset()
          }
        }}
        title={t('operations:supplier.ledger.reversalTitle')}
        desc={t('operations:supplier.ledger.reversalDescription', {
          amount: reversalTarget?.amount ?? '',
          currency: reversalTarget?.currencyCode ?? '',
        })}
        cancelBtnText={t('operations:supplier.ledger.keepPayment')}
        confirmText={t('operations:supplier.ledger.reversalConfirm')}
        destructive
        isLoading={reversal.isPending}
        handleConfirm={() => {
          if (reversalTarget?.moneyMovementUuid != null)
            reversal.mutate(reversalTarget.moneyMovementUuid)
        }}
      >
        {reversal.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {errorMessage(reversal.error)}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}
