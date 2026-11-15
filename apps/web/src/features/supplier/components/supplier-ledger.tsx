import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
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
  const organizationSlug = useOrganizationSlug()
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
      toast.success('Supplier payment recorded')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const reversal = useMutation({
    mutationFn: (target: string) => financeApi.reverse(target),
    onSuccess: async () => {
      setReversalTarget(null)
      await invalidate()
      toast.success('Supplier payment reversed')
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
          <h2 className='text-xl font-semibold'>Supplier ledger</h2>
          <p className='text-sm text-muted-foreground'>
            Completing a purchase order posts its total as debt and settles it
            with an equal auto-posted payment, so the completed order carries no
            unpaid amount; that same transaction takes the cash once. A manual
            payment posts the exact cash outflow and the same debt reduction.
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
            Record payment
          </Button>
        </div>
      </div>
      {ledger.isPending && <p role='status'>Loading supplier ledger…</p>}
      {ledger.isError && (
        <p role='alert'>
          {errorMessage(ledger.error)}{' '}
          <Button variant='outline' onClick={() => void ledger.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && !ledger.isError && (
        <>
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>Currency</dt>
            <dd>{data.currencyCode ?? 'Finance is not configured yet'}</dd>
            <dt>Outstanding</dt>
            <dd className='font-medium'>
              {`${data.outstanding} ${data.currencyCode ?? ''}`.trim()}
            </dd>
          </dl>
          {data.outstanding.startsWith('-') && (
            <p className='text-sm text-muted-foreground'>
              A negative balance is a supplier credit (advance).
            </p>
          )}
          <Table>
            <caption className='sr-only'>
              Ledger entries for {supplierName}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
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
                    {entry.purchaseOrderUuid != null ? (
                      <Link
                        to='/o/$organizationSlug/purchasing/$orderId'
                        params={{
                          organizationSlug,
                          orderId: entry.purchaseOrderUuid,
                        }}
                        className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                      >
                        {entry.purchaseOrderReference ?? 'Purchase order'}
                      </Link>
                    ) : entry.moneyMovementUuid != null ? (
                      <Link
                        to='/o/$organizationSlug/finance/$movementId'
                        params={{
                          organizationSlug,
                          movementId: entry.moneyMovementUuid,
                        }}
                        className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                      >
                        Money movement
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.kind === 'reversal'
                      ? 'Reversal'
                      : entry.reversed
                        ? 'Reversed'
                        : 'Posted'}
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
                        Reverse
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    No ledger entries for this supplier yet.
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
          title='Record supplier payment'
          description='A payment posts an exact cash outflow and reduces what this supplier is owed by the same amount. A payment above the debt leaves a supplier credit.'
          currencyCode={data?.currencyCode ?? null}
          submitLabel='Record payment'
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
        title='Reverse supplier payment'
        desc={`Reverse the payment of ${reversalTarget?.amount ?? ''} ${
          reversalTarget?.currencyCode ?? ''
        }? The cash inflow and the debt reduction are reversed together, once.`}
        cancelBtnText='Keep payment'
        confirmText='Reverse payment'
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
