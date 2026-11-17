import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  isBranchScopeCurrent,
} from '@/lib/branch-scope'
import { isPositiveDecimal } from '@/lib/decimal-string'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import {
  organizationLocation,
  useOrganizationResourceParams,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
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
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
  errorMessage as financeErrorMessage,
  financeApi,
} from '@/features/finance/api'
import { MoneyForm } from '@/features/finance/components/money-form'
import { errorMessage, salesApi } from './api'
import type { SaleIngredient, SaleReceipt, SaleReceiptInput } from './model'

export function SaleDetail() {
  const { saleId } = useOrganizationResourceParams()
  const uuid = saleId === undefined ? null : parseResourceUuid(saleId)
  return <SaleDetailView key={uuid ?? 'invalid'} uuid={uuid} />
}

function SaleDetailView({ uuid }: { uuid: string | null }) {
  const branch = useOptionalBranch()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const branchUuid = branch?.branchUuid ?? null
  const scopeKey = branchCacheScope(branchUuid)
  const captured = captureBranchScope(branchUuid)
  const writable = branch?.branch.active ?? false
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [reversalTarget, setReversalTarget] = useState<SaleReceipt | null>(null)
  const sale = useQuery({
    queryKey: ['sales', scopeKey, 'detail', uuid, branchUuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return salesApi.get(branchUuid, uuid)
    },
    enabled: uuid !== null,
  })
  const receipt = useMutation({
    mutationFn: (input: { uuid: string; body: SaleReceiptInput }) => {
      if (branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesApi.receipt(branchUuid, input.uuid, input.body)
    },
    onSuccess: async () => {
      // Receipts change the sale's payment state, so the company aggregate of
      // the same organization goes stale with the branch scope. The key is
      // derived from the captured organization scope, never the ambient one.
      const companyScope = `${captured.organizationScope}::company`
      await Promise.all([
        client.invalidateQueries({ queryKey: ['sales', captured.scope] }),
        client.invalidateQueries({ queryKey: ['sales', companyScope] }),
        client.invalidateQueries({
          queryKey: ['finance', captured.organizationScope],
        }),
      ])
      if (!isBranchScopeCurrent(captured)) return
      setReceiptOpen(false)
      toast.success(t('operations:sales.detail.receiptRecorded'))
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const reversal = useMutation({
    mutationFn: (movementUuid: string) => financeApi.reverse(movementUuid),
    onSuccess: async () => {
      // A reversal changes the sale's payment state and the company finance
      // projection, so the same-organization aggregate list is invalidated
      // together with the captured branch keys.
      const companyScope = `${captured.organizationScope}::company`
      await Promise.all([
        client.invalidateQueries({ queryKey: ['sales', captured.scope] }),
        client.invalidateQueries({ queryKey: ['sales', companyScope] }),
        client.invalidateQueries({
          queryKey: ['finance', captured.organizationScope],
        }),
      ])
      if (!isBranchScopeCurrent(captured)) return
      setReversalTarget(null)
      toast.success(t('operations:sales.detail.receiptReversed'))
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      toast.error(financeErrorMessage(caught))
    },
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
            {...organizationLocation(organizationSlug, branchUuid, '/sales')}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:sales.detail.back')}
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !sale.isError
              ? t('operations:sales.detail.titleWithReference', {
                  reference: record.reference || record.referenceInt,
                })
              : t('operations:sales.detail.title')}
          </h1>
        </div>
        {branch !== null && !branch.branch.active && (
          <BranchInactiveNotice branchName={branch.branch.name} />
        )}
        {uuid === null && (
          <p role='alert'>{t('operations:sales.detail.notFound')}</p>
        )}
        {uuid !== null && sale.isPending && (
          <p role='status'>{t('operations:sales.detail.loading')}</p>
        )}
        {uuid !== null && sale.isError && detailStatus === 404 && (
          <p role='alert'>{t('operations:sales.detail.notFound')}</p>
        )}
        {uuid !== null && sale.isError && detailStatus !== 404 && (
          <p role='alert'>
            {t('operations:sales.detail.loadError')}{' '}
            <Button variant='outline' onClick={() => void sale.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}
        {record && !sale.isError && (
          <>
            <section className='space-y-2 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>
                {t('operations:sales.detail.sectionTitle')}
              </h2>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>{t('operations:sales.detail.fields.reference')}</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>{t('operations:sales.detail.fields.branch')}</dt>
                <dd>
                  {record.branch.name}
                  {record.branch.uuid === branchUuid
                    ? ''
                    : t('operations:sales.detail.sourceBranchSuffix')}
                </dd>
                <dt>{t('operations:sales.detail.fields.recipe')}</dt>
                <dd>{record.recipeName || '—'}</dd>
                <dt>{t('operations:sales.detail.fields.recipeVersion')}</dt>
                <dd>{record.recipeVersion}</dd>
                {record.recipeDefinitionUuid !== null && (
                  <>
                    <dt>
                      {t('operations:sales.detail.fields.recipeDefinition')}
                    </dt>
                    <dd className='break-all'>
                      {record.recipeDefinitionUuid}
                      {record.recipeSourceVersion === null
                        ? ''
                        : t('operations:sales.detail.customization', {
                            version: record.recipeSourceVersion,
                          })}
                    </dd>
                  </>
                )}
                <dt>{t('operations:sales.detail.fields.channel')}</dt>
                <dd>{record.channelName ?? '—'}</dd>
                <dt>{t('operations:sales.detail.fields.businessDate')}</dt>
                <dd>{record.businessDate ?? '—'}</dd>
                <dt>{t('operations:sales.detail.fields.batch')}</dt>
                <dd>
                  {record.batchUuid == null ? (
                    '—'
                  ) : (
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        record.branch.uuid,
                        '/sales/batches/$batchId',
                        { batchId: record.batchUuid }
                      )}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {record.batchReference ?? record.batchUuid}
                    </Link>
                  )}
                </dd>
                {record.sourceRow != null && (
                  <>
                    <dt>{t('operations:sales.detail.fields.source')}</dt>
                    <dd>
                      {t('operations:sales.detail.sourceRow', {
                        sheet:
                          record.sourceSheet ??
                          t('operations:sales.detail.sheet'),
                        row: record.sourceRow,
                      })}
                      {record.sourceChannelText
                        ? ` · ${record.sourceChannelText}`
                        : ''}
                      {record.sourceProductText
                        ? ` · ${record.sourceProductText}`
                        : ''}
                    </dd>
                  </>
                )}
                <dt>{t('operations:sales.detail.fields.quantity')}</dt>
                <dd>{record.quantity}</dd>
                <dt>{t('operations:sales.detail.fields.recorded')}</dt>
                <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
                <dt>{t('operations:sales.detail.fields.staff')}</dt>
                <dd>{record.createdByName}</dd>
                <dt>{t('operations:sales.detail.fields.ingredients')}</dt>
                <dd>{record.ingredientCount}</dd>
              </dl>
            </section>
            <section className='space-y-3 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>
                {t('operations:sales.detail.paymentTitle')}
              </h2>
              {!priced ? (
                <p className='text-sm text-muted-foreground'>
                  {t('operations:sales.detail.noPrice')}
                </p>
              ) : (
                <>
                  <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                    <dt>{t('operations:sales.detail.fields.currency')}</dt>
                    <dd>{record.currencyCode}</dd>
                    <dt>{t('operations:sales.detail.fields.unitPrice')}</dt>
                    <dd>
                      {record.unitPrice ?? '—'} {record.currencyCode}
                    </dd>
                    <dt>{t('operations:sales.detail.fields.saleTotal')}</dt>
                    <dd>
                      {record.totalPrice} {record.currencyCode}
                    </dd>
                    <dt>{t('operations:sales.detail.fields.collected')}</dt>
                    <dd>
                      {record.collectedAmount} {record.currencyCode}
                    </dd>
                    <dt>{t('operations:sales.detail.fields.outstanding')}</dt>
                    <dd className='font-medium'>
                      {record.outstandingAmount} {record.currencyCode}
                    </dd>
                  </dl>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      disabled={
                        !writable ||
                        !isPositiveDecimal(record.outstandingAmount ?? '0')
                      }
                      onClick={() => {
                        receipt.reset()
                        setReceiptOpen(true)
                      }}
                    >
                      {t('operations:sales.detail.recordReceipt')}
                    </Button>
                  </div>
                  <Table>
                    <caption className='sr-only'>
                      {t('operations:sales.detail.receiptsCaption')}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t('operations:sales.detail.receipts.date')}
                        </TableHead>
                        <TableHead>
                          {t('operations:sales.detail.receipts.type')}
                        </TableHead>
                        <TableHead>
                          {t('operations:sales.detail.receipts.amount')}
                        </TableHead>
                        <TableHead>
                          {t('operations:sales.detail.receipts.note')}
                        </TableHead>
                        <TableHead>
                          {t('operations:sales.detail.receipts.status')}
                        </TableHead>
                        <TableHead>
                          {t('operations:sales.detail.receipts.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.receipts.map((entry) => (
                        <TableRow key={entry.uuid}>
                          <TableCell>{entry.occurredAt}</TableCell>
                          <TableCell>
                            {entry.kind === 'reversal'
                              ? t('operations:sales.detail.receipts.reversal')
                              : t('operations:sales.detail.receipts.receipt')}
                          </TableCell>
                          <TableCell>
                            {entry.amount} {record.currencyCode}
                          </TableCell>
                          <TableCell>{entry.note || '—'}</TableCell>
                          <TableCell>
                            {entry.kind === 'reversal'
                              ? t('operations:sales.detail.receipts.reversal')
                              : entry.reversed
                                ? t('operations:sales.detail.receipts.reversed')
                                : t('operations:sales.detail.receipts.posted')}
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap items-center gap-2'>
                              <Link
                                {...organizationLocation(
                                  organizationSlug,
                                  null,
                                  '/finance/$movementId',
                                  { movementId: entry.uuid }
                                )}
                                aria-label={t(
                                  'operations:sales.detail.receiptDetailsLabel'
                                )}
                                className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                              >
                                {t('operations:sales.detail.receipts.details')}
                              </Link>
                              {entry.kind === 'receipt' &&
                                !entry.reversed &&
                                writable && (
                                  <Button
                                    type='button'
                                    variant='outline'
                                    onClick={() => {
                                      reversal.reset()
                                      setReversalTarget(entry)
                                    }}
                                  >
                                    {t(
                                      'operations:sales.detail.receipts.reverse'
                                    )}
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {record.receipts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            {t('operations:sales.detail.receipts.empty')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </section>
            <section className='space-y-2'>
              <h2 className='text-xl font-semibold'>
                {t('operations:sales.detail.ingredientsTitle')}
              </h2>
              <Table>
                <caption className='sr-only'>
                  {t('operations:sales.detail.ingredientsCaption')}
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t(
                        'operations:sales.detail.ingredientColumns.ingredient'
                      )}
                    </TableHead>
                    <TableHead>
                      {t('operations:sales.detail.ingredientColumns.perRecipe')}
                    </TableHead>
                    <TableHead>
                      {t('operations:sales.detail.ingredientColumns.required')}
                    </TableHead>
                    <TableHead>
                      {t('operations:sales.detail.ingredientColumns.consumed')}
                    </TableHead>
                    <TableHead>
                      {t('operations:sales.detail.ingredientColumns.units')}
                    </TableHead>
                    <TableHead>
                      {t('operations:sales.detail.ingredientColumns.note')}
                    </TableHead>
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
                        {t('operations:sales.detail.ingredientsEmpty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
            <section className='space-y-2'>
              <h2 className='text-xl font-semibold'>
                {t('operations:sales.detail.consumptionTitle')}
              </h2>
              {record.consumptions.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  {t('operations:sales.detail.consumptionEmpty')}
                </p>
              ) : (
                <>
                  <Table>
                    <caption className='sr-only'>
                      {t('operations:sales.detail.consumptionCaption')}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t(
                            'operations:sales.detail.ingredientColumns.ingredient'
                          )}
                        </TableHead>
                        <TableHead>
                          {t('operations:sales.detail.consumptionColumns.item')}
                        </TableHead>
                        <TableHead>
                          {t(
                            'operations:sales.detail.ingredientColumns.consumed'
                          )}
                        </TableHead>
                        <TableHead>
                          {t(
                            'operations:sales.detail.consumptionColumns.before'
                          )}
                        </TableHead>
                        <TableHead>
                          {t(
                            'operations:sales.detail.consumptionColumns.after'
                          )}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.consumptions.map((consumption) => (
                        <TableRow key={consumption.uuid}>
                          <TableCell>
                            {ingredientNames.get(
                              consumption.buildComponentUuid
                            ) ??
                              t('operations:sales.detail.ingredientFallback')}
                          </TableCell>
                          <TableCell className='break-all'>
                            {consumption.itemUuid != null ? (
                              <Link
                                {...organizationLocation(
                                  organizationSlug,
                                  record.branch.uuid,
                                  '/stock/$itemId',
                                  { itemId: consumption.itemUuid }
                                )}
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
      {receiptOpen && record && writable && (
        <MoneyForm
          title={t('operations:sales.detail.receiptFormTitle')}
          description={t('operations:sales.detail.receiptFormDescription')}
          currencyCode={record.currencyCode}
          hint={t('operations:sales.detail.receiptFormHint', {
            amount: record.outstandingAmount,
            currency: record.currencyCode ?? '',
          }).trim()}
          submitLabel={t('operations:sales.detail.recordReceipt')}
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
        open={reversalTarget !== null && writable}
        onOpenChange={(open) => {
          if (!open && !reversal.isPending) {
            setReversalTarget(null)
            reversal.reset()
          }
        }}
        title={t('operations:sales.detail.reversalTitle')}
        desc={t('operations:sales.detail.reversalDescription')}
        cancelBtnText={t('operations:sales.detail.keepReceipt')}
        confirmText={t('operations:sales.detail.reversalConfirm')}
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
      <TableCell>
        {ingredient.itemUnits || t('operations:common.unknownUnit')}
      </TableCell>
      <TableCell>{ingredient.note || '—'}</TableCell>
    </TableRow>
  )
}
