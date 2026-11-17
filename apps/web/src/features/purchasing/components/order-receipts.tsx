import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { invalidateBranchStockCaches } from '@/lib/item-stock-cache'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, purchasingApi } from '../api'
import {
  purchaseOrderStatusLabel,
  type PurchaseLine,
  type PurchaseOrder,
  type PurchaseReceipt,
} from '../model'

const shortUuid = (uuid: string) => uuid.slice(0, 8)

const receiptEvent = (receipt: PurchaseReceipt) =>
  receipt.legacyBaseline
    ? t('operations:purchasing.receipts.eventLegacy')
    : receipt.reversalOfUuid
      ? t('operations:purchasing.receipts.eventReversal')
      : t('operations:purchasing.receipts.eventReceipt')

function ReceiptRow({
  receipt,
  line,
  canCorrect,
  onReverse,
  reversing,
}: {
  receipt: PurchaseReceipt
  line: PurchaseLine | undefined
  canCorrect: boolean
  onReverse: () => void
  reversing: boolean
}) {
  const reversible =
    canCorrect &&
    !receipt.legacyBaseline &&
    receipt.reversalOfUuid === null &&
    receipt.reversalUuid === null
  const itemLabel =
    line?.item?.name ?? t('operations:purchasing.receipts.lineUnavailable')
  return (
    <TableRow>
      <TableCell>
        {receipt.occurredAt === null
          ? t('operations:purchasing.receipts.notRecorded')
          : new Date(receipt.occurredAt).toLocaleString(locale)}
      </TableCell>
      <TableCell>{receiptEvent(receipt)}</TableCell>
      <TableCell>{receipt.branch.name}</TableCell>
      <TableCell>{itemLabel}</TableCell>
      <TableCell>{receipt.quantity}</TableCell>
      <TableCell>
        {receipt.stockQuantity ??
          t('operations:purchasing.receipts.notRecorded')}
      </TableCell>
      <TableCell>
        {receipt.unitCode ?? t('operations:purchasing.receipts.notRecorded')}
      </TableCell>
      <TableCell>
        {receipt.purchasePrice === null
          ? t('operations:purchasing.receipts.notRecorded')
          : receipt.purchasePrice}
      </TableCell>
      <TableCell>
        {receipt.discount === null
          ? t('operations:purchasing.receipts.notRecorded')
          : receipt.discount}
      </TableCell>
      <TableCell>
        {receipt.purchasePrice === null
          ? t('operations:purchasing.receipts.notRecorded')
          : (receipt.currencyCode ??
            t('operations:purchasing.receipts.notRecorded'))}
      </TableCell>
      <TableCell className='max-w-48'>{receipt.notes ?? '—'}</TableCell>
      <TableCell>
        {receipt.userId ?? t('operations:purchasing.receipts.notRecorded')}
      </TableCell>
      <TableCell>
        {receipt.reversalOfUuid && (
          <p className='text-xs text-muted-foreground'>
            {t('operations:purchasing.receipts.corrects', {
              uuid: shortUuid(receipt.reversalOfUuid),
            })}
          </p>
        )}
        {receipt.reversalUuid && (
          <p className='text-xs text-muted-foreground'>
            {t('operations:purchasing.receipts.reversedBy', {
              uuid: shortUuid(receipt.reversalUuid),
            })}
          </p>
        )}
        {reversible && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={reversing}
            onClick={onReverse}
          >
            {t('operations:purchasing.receipts.reverse')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

/**
 * Immutable receipt event history: one row per receipt event and destination
 * branch, with the price, unit and currency snapshots recorded at receipt
 * time. Legacy baselines keep their unknown price, actor and time visible
 * instead of inventing values. Corrections are compensating events; the
 * original row is never rewritten.
 */
export function OrderReceipts({
  order,
  lines,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
}) {
  const client = useQueryClient()
  const selectedBranch = useOptionalBranch()
  const lineFilterId = useId()
  const branchFilterId = useId()
  const scope = organizationCacheScope()
  const [page, setPage] = useState(0)
  const [lineFilter, setLineFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [reverseTarget, setReverseTarget] = useState<{
    receipt: PurchaseReceipt
    requestKey: string
  } | null>(null)
  const receipts = useQuery({
    queryKey: [
      'purchasing',
      scope,
      'receipts',
      order.uuid,
      page,
      lineFilter,
      branchFilter,
    ],
    queryFn: () =>
      purchasingApi.receipts(order.uuid, {
        page,
        lineUuid: lineFilter === 'all' ? undefined : lineFilter,
        branchUuid: branchFilter === 'all' ? undefined : branchFilter,
      }),
    refetchOnWindowFocus: false,
  })
  const branches = useQuery({
    queryKey: ['purchasing', scope, 'destination-branches'],
    queryFn: () => purchasingApi.receiptBranches(),
    refetchOnWindowFocus: false,
  })
  const linesByUuid = new Map(lines.map((line) => [line.uuid, line]))
  const reverse = useMutation({
    mutationFn: (input: {
      receipt: PurchaseReceipt
      requestKey: string
      scope: string
      ui: CapturedBranchScope
    }) =>
      purchasingApi.reverse(order.uuid, input.receipt.uuid, {
        version: order.version,
        requestKey: input.requestKey,
      }),
    onSuccess: async (_result, input) => {
      // Receipt history and the original destination branch are refreshed on
      // every settlement; the replaced UI only reacts while its captured
      // branch is still selected.
      await client.invalidateQueries({ queryKey: ['purchasing', input.scope] })
      await invalidateBranchStockCaches(
        client,
        captureBranchScope(input.receipt.branchUuid)
      )
      if (!isBranchScopeCurrent(input.ui)) return
      setReverseTarget(null)
      toast.success(t('operations:purchasing.receipts.reversed'))
    },
    onError: (caught, input) => {
      if (isBranchScopeCurrent(input.ui)) toast.error(errorMessage(caught))
    },
  })
  return (
    <section className='space-y-3'>
      <div>
        <h2 className='text-xl font-semibold'>
          {t('operations:purchasing.receipts.title')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('operations:purchasing.receipts.description')}
        </p>
        {order.status !== 20 && (
          <p className='text-sm text-muted-foreground'>
            {t('operations:purchasing.receipts.readOnly', {
              status: purchaseOrderStatusLabel(order.status),
            })}
          </p>
        )}
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='flex items-center gap-2'>
          <Label htmlFor={lineFilterId} className='font-normal'>
            {t('operations:purchasing.receipts.lineFilter')}
          </Label>
          <Select
            value={lineFilter}
            onValueChange={(value) => {
              setLineFilter(value)
              setPage(0)
            }}
          >
            <SelectTrigger id={lineFilterId} className='w-56'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>
                {t('operations:purchasing.receipts.allLines')}
              </SelectItem>
              {lines.map((line) => (
                <SelectItem key={line.uuid} value={line.uuid}>
                  {line.item?.name ??
                    t('operations:purchasing.receipts.lineFallback', {
                      uuid: shortUuid(line.uuid),
                    })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center gap-2'>
          <Label htmlFor={branchFilterId} className='font-normal'>
            {t('operations:purchasing.receipts.branchFilter')}
          </Label>
          <Select
            value={branchFilter}
            onValueChange={(value) => {
              setBranchFilter(value)
              setPage(0)
            }}
          >
            <SelectTrigger id={branchFilterId} className='w-56'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>
                {t('operations:purchasing.receipts.allBranches')}
              </SelectItem>
              {(branches.data ?? []).map((branch) => (
                <SelectItem key={branch.uuid} value={branch.uuid}>
                  {branch.name}
                  {branch.active ? '' : t('operations:common.inactiveSuffix')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {receipts.isPending && (
        <p role='status'>{t('operations:purchasing.receipts.loading')}</p>
      )}
      {receipts.isError && (
        <p role='alert'>
          {errorMessage(receipts.error)}{' '}
          <Button variant='outline' onClick={() => void receipts.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {receipts.data && (
        <>
          <Table>
            <caption className='sr-only'>
              {t('operations:purchasing.receipts.caption')}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.when')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.event')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.destination')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.line')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.quantity')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.stockQuantity')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.unit')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.unitPrice')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.discount')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.currency')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.notes')}
                </TableHead>
                <TableHead>
                  {t('operations:purchasing.receipts.columns.recordedBy')}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.data.items.map((receipt) => (
                <ReceiptRow
                  key={receipt.uuid}
                  receipt={receipt}
                  line={linesByUuid.get(receipt.lineUuid)}
                  canCorrect={order.status === 20}
                  reversing={
                    reverse.isPending &&
                    reverseTarget?.receipt.uuid === receipt.uuid
                  }
                  onReverse={() => {
                    reverse.reset()
                    setReverseTarget({
                      receipt,
                      requestKey: crypto.randomUUID(),
                    })
                  }}
                />
              ))}
              {receipts.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13}>
                    {t('operations:purchasing.receipts.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            hasNext={(page + 1) * receipts.data.limit < receipts.data.total}
            loading={receipts.isFetching}
            onChange={setPage}
          />
        </>
      )}
      <ConfirmDialog
        open={reverseTarget != null}
        onOpenChange={(open) => {
          if (!open && !reverse.isPending) setReverseTarget(null)
        }}
        title={t('operations:purchasing.receipts.reverseTitle')}
        desc={
          reverseTarget === null
            ? ''
            : t('operations:purchasing.receipts.reverseDescription', {
                quantity: reverseTarget.receipt.quantity,
                branch: reverseTarget.receipt.branch.name,
              })
        }
        cancelBtnText={t('operations:purchasing.receipts.keepReceipt')}
        confirmText={t('operations:purchasing.receipts.reverse')}
        destructive
        disabled={reverseTarget === null}
        isLoading={reverse.isPending}
        handleConfirm={() => {
          if (reverseTarget === null || reverse.isPending) return
          reverse.mutate({
            receipt: reverseTarget.receipt,
            requestKey: reverseTarget.requestKey,
            scope,
            ui: captureBranchScope(selectedBranch?.branch.uuid ?? null),
          })
        }}
      >
        {reverse.isError && (
          <p role='alert' className='text-destructive'>
            {errorMessage(reverse.error)}
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}
