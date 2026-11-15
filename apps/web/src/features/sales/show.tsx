import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { isPositiveDecimal } from '@/lib/decimal-string'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
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
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
  errorMessage as financeErrorMessage,
  financeApi,
} from '@/features/finance/api'
import { MoneyForm } from '@/features/finance/components/money-form'
import { errorMessage, salesApi } from './api'
import type { SaleIngredient, SaleReceipt } from './model'

const saleRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/sales/$saleId'
)

export function SaleDetail() {
  const { saleId } = saleRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const uuid = parseResourceUuid(saleId)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [reversalTarget, setReversalTarget] = useState<SaleReceipt | null>(null)
  const sale = useQuery({
    queryKey: ['sales', organizationCacheScope(), 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Sale uuid is required')
      return salesApi.get(uuid)
    },
    enabled: uuid !== null,
  })
  const receipt = useMutation({
    mutationFn: (input: {
      uuid: string
      body: Parameters<typeof salesApi.receipt>[1]
    }) => salesApi.receipt(input.uuid, input.body),
    onSuccess: async () => {
      setReceiptOpen(false)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['sales', scope] }),
        client.invalidateQueries({ queryKey: ['finance', scope] }),
      ])
      toast.success('Receipt recorded')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const reversal = useMutation({
    mutationFn: (movementUuid: string) => financeApi.reverse(movementUuid),
    onSuccess: async () => {
      setReversalTarget(null)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['sales', scope] }),
        client.invalidateQueries({ queryKey: ['finance', scope] }),
      ])
      toast.success('Receipt reversed')
    },
    onError: (caught) => toast.error(financeErrorMessage(caught)),
  })
  const detailStatus =
    sale.error && axios.isAxiosError(sale.error)
      ? sale.error.response?.status
      : undefined
  const record = sale.data
  const priced =
    record != null && record.currencyCode != null && record.totalPrice != null
  const ingredientNames = new Map(
    (record?.ingredients ?? []).map(
      (ingredient) => [ingredient.uuid, ingredient.itemName] as const
    )
  )
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/sales'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to sales
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !sale.isError
              ? `Sale ${record.reference || record.referenceInt}`
              : 'Sale'}
          </h1>
        </div>
        {uuid === null && <p role='alert'>Sale not found.</p>}
        {uuid !== null && sale.isPending && <p role='status'>Loading sale…</p>}
        {uuid !== null && sale.isError && detailStatus === 404 && (
          <p role='alert'>Sale not found.</p>
        )}
        {uuid !== null && sale.isError && detailStatus !== 404 && (
          <p role='alert'>
            Could not load this sale.{' '}
            <Button variant='outline' onClick={() => void sale.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {record && !sale.isError && (
          <>
            <section className='space-y-2 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>Sale details</h2>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>Reference</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>Recipe</dt>
                <dd>{record.recipeName || '—'}</dd>
                <dt>Recipe version</dt>
                <dd>{record.recipeVersion}</dd>
                <dt>Channel</dt>
                <dd>{record.channelName ?? '—'}</dd>
                <dt>Sale date</dt>
                <dd>{record.businessDate ?? '—'}</dd>
                <dt>Batch</dt>
                <dd>
                  {record.batchUuid == null ? (
                    '—'
                  ) : (
                    <Link
                      to='/o/$organizationSlug/sales/batches/$batchId'
                      params={{
                        organizationSlug,
                        batchId: record.batchUuid,
                      }}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.batchReference ?? record.batchUuid}
                    </Link>
                  )}
                </dd>
                {record.sourceRow != null && (
                  <>
                    <dt>Source</dt>
                    <dd>
                      {record.sourceSheet ?? 'Sheet'} row {record.sourceRow}
                      {record.sourceChannelText
                        ? ` · ${record.sourceChannelText}`
                        : ''}
                      {record.sourceProductText
                        ? ` · ${record.sourceProductText}`
                        : ''}
                    </dd>
                  </>
                )}
                <dt>Quantity</dt>
                <dd>{record.quantity}</dd>
                <dt>Recorded</dt>
                <dd>{new Date(record.createdAt).toLocaleString()}</dd>
                <dt>Staff</dt>
                <dd>{record.createdByName}</dd>
                <dt>Ingredients</dt>
                <dd>{record.ingredientCount}</dd>
              </dl>
            </section>
            <section className='space-y-3 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>Payment</h2>
              {!priced ? (
                <p className='text-sm text-muted-foreground'>
                  This sale has no recorded price, so no receipt can be
                  recorded. Only priced sales created after finance was
                  configured can receive payments.
                </p>
              ) : (
                <>
                  <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                    <dt>Currency</dt>
                    <dd>{record.currencyCode}</dd>
                    <dt>Unit price</dt>
                    <dd>
                      {record.unitPrice ?? '—'} {record.currencyCode}
                    </dd>
                    <dt>Sale total</dt>
                    <dd>
                      {record.totalPrice} {record.currencyCode}
                    </dd>
                    <dt>Collected</dt>
                    <dd>
                      {record.collectedAmount} {record.currencyCode}
                    </dd>
                    <dt>Outstanding</dt>
                    <dd className='font-medium'>
                      {record.outstandingAmount} {record.currencyCode}
                    </dd>
                  </dl>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      disabled={
                        !isPositiveDecimal(record.outstandingAmount ?? '0')
                      }
                      onClick={() => {
                        receipt.reset()
                        setReceiptOpen(true)
                      }}
                    >
                      Record receipt
                    </Button>
                  </div>
                  <Table>
                    <caption className='sr-only'>
                      Receipts posted for this sale
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.receipts.map((entry) => (
                        <TableRow key={entry.uuid}>
                          <TableCell>{entry.occurredAt}</TableCell>
                          <TableCell>
                            {entry.kind === 'reversal' ? 'Reversal' : 'Receipt'}
                          </TableCell>
                          <TableCell>
                            {entry.amount} {record.currencyCode}
                          </TableCell>
                          <TableCell>{entry.note || '—'}</TableCell>
                          <TableCell>
                            {entry.kind === 'reversal'
                              ? 'Reversal'
                              : entry.reversed
                                ? 'Reversed'
                                : 'Posted'}
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap items-center gap-2'>
                              <Link
                                to='/o/$organizationSlug/finance/$movementId'
                                params={{
                                  organizationSlug,
                                  movementId: entry.uuid,
                                }}
                                aria-label='Details for this receipt'
                                className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                              >
                                Details
                              </Link>
                              {entry.kind === 'receipt' && !entry.reversed && (
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
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {record.receipts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            No receipts have been recorded for this sale.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </section>
            <section className='space-y-2'>
              <h2 className='text-xl font-semibold'>Ingredient snapshot</h2>
              <Table>
                <caption className='sr-only'>
                  Ingredients recorded for this sale
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Per recipe</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Consumed</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.ingredients.map((ingredient) => (
                    <IngredientRow
                      key={ingredient.uuid}
                      ingredient={ingredient}
                    />
                  ))}
                  {record.ingredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        No ingredients were recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
            <section className='space-y-2'>
              <h2 className='text-xl font-semibold'>Item stock consumption</h2>
              {record.consumptions.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No item stock was consumed for this sale.
                </p>
              ) : (
                <>
                  <Table>
                    <caption className='sr-only'>
                      Item stock consumed by this sale
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Before</TableHead>
                        <TableHead>After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.consumptions.map((consumption) => (
                        <TableRow key={consumption.uuid}>
                          <TableCell>
                            {ingredientNames.get(
                              consumption.buildComponentUuid
                            ) ?? 'Ingredient'}
                          </TableCell>
                          <TableCell className='break-all'>
                            {consumption.itemUuid != null ? (
                              <Link
                                to='/o/$organizationSlug/stock/$itemId'
                                params={{
                                  organizationSlug,
                                  itemId: consumption.itemUuid,
                                }}
                                className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                              >
                                {consumption.itemUuid}
                              </Link>
                            ) : (
                              consumption.itemUuidRef
                            )}
                          </TableCell>
                          <TableCell>{consumption.quantity}</TableCell>
                          <TableCell>{consumption.quantityBefore}</TableCell>
                          <TableCell>{consumption.quantityAfter}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </section>
          </>
        )}
      </Main>
      {receiptOpen && record && (
        <MoneyForm
          title='Record sale receipt'
          description='A receipt posts a cash inflow against this sale. It cannot exceed the outstanding amount, and a retry with the same request key never posts twice.'
          currencyCode={record.currencyCode}
          hint={`Outstanding ${record.outstandingAmount} ${record.currencyCode ?? ''}`.trim()}
          submitLabel='Record receipt'
          pending={receipt.isPending}
          error={receipt.error}
          onClose={() => {
            if (!receipt.isPending) setReceiptOpen(false)
          }}
          onSubmit={(input) => {
            if (uuid !== null) receipt.mutate({ uuid, body: input })
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
        title='Reverse sale receipt'
        desc='Reversing posts one linked cash outflow, frees the outstanding amount again and keeps the original receipt immutable. This cannot be undone or repeated.'
        cancelBtnText='Keep receipt'
        confirmText='Reverse receipt'
        destructive
        isLoading={reversal.isPending}
        handleConfirm={() => {
          if (reversalTarget) reversal.mutate(reversalTarget.uuid)
        }}
      >
        {reversal.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {financeErrorMessage(reversal.error)}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

function IngredientRow({ ingredient }: { ingredient: SaleIngredient }) {
  return (
    <TableRow>
      <TableCell>
        {ingredient.itemName}
        {ingredient.itemIpn ? ` · ${ingredient.itemIpn}` : ''}
      </TableCell>
      <TableCell>{ingredient.quantityPerRecipe}</TableCell>
      <TableCell>{ingredient.requiredQuantity}</TableCell>
      <TableCell>{ingredient.consumedQuantity}</TableCell>
      <TableCell>{ingredient.itemUnits || 'Unknown unit'}</TableCell>
      <TableCell>{ingredient.note || '—'}</TableCell>
    </TableRow>
  )
}
