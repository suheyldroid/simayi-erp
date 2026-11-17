import { useState } from 'react'
import axios from 'axios'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { invalidateBranchStockCaches } from '@/lib/item-stock-cache'
import {
  useOrganizationBoundary,
  useOrganizationSlug,
} from '@/lib/organization-boundary'
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
import { BatchZReports } from '@/features/pos-devices/components/batch-reports'
import { batchRowProblems, errorMessage, salesBatchesApi } from './api'
import { BatchMapping } from './components/batch-mapping'
import { batchIssueLabel, type BatchIssue } from './issue-labels'
import {
  batchStatusLabel,
  type BatchPatch,
  type BatchPreview,
  type BatchPreviewRow,
} from './model'

async function refreshBatchCaches(
  client: QueryClient,
  captured: CapturedBranchScope,
  organizationId: string
) {
  // Company aggregate of the same organization: processing records sales and
  // deleting reverses them, so the company index goes stale with the branch.
  const companyScope = `${captured.organizationScope}::company`
  await Promise.all([
    client.invalidateQueries({ queryKey: ['sales', captured.scope] }),
    client.invalidateQueries({ queryKey: ['sales', companyScope] }),
    invalidateBranchStockCaches(client, captured),
    client.invalidateQueries({
      queryKey: ['dashboard', 'builder', 'organization', organizationId],
    }),
  ])
}

export function SalesBatchDetail() {
  const { batchId } = useOrganizationResourceParams()
  const uuid = batchId === undefined ? null : parseResourceUuid(batchId)
  return <SalesBatchDetailView key={uuid ?? 'invalid'} uuid={uuid} />
}

function SalesBatchDetailView({ uuid }: { uuid: string | null }) {
  const branch = useOptionalBranch()
  const organizationSlug = useOrganizationSlug()
  const { organizationId } = useOrganizationBoundary()
  const client = useQueryClient()
  const navigate = useNavigate()
  const branchUuid = branch?.branchUuid ?? null
  const scopeKey = branchCacheScope(branchUuid)
  const captured = captureBranchScope(branchUuid)
  const writable = branch?.branch.active ?? false
  const [mappingOpen, setMappingOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exclusionEdits, setExclusionEdits] = useState<number[] | null>(null)
  // Preview snapshot the last process rejection belongs to.
  const [rejectedPreviewAt, setRejectedPreviewAt] = useState<number | null>(
    null
  )

  const batch = useQuery({
    queryKey: ['sales', scopeKey, 'batches', 'detail', uuid, branchUuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return salesBatchesApi.get(branchUuid, uuid)
    },
    enabled: uuid !== null,
  })
  const preview = useQuery({
    queryKey: ['sales', scopeKey, 'batches', 'preview', uuid, branchUuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      if (branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesBatchesApi.preview(branchUuid, uuid)
    },
    enabled: branchUuid !== null && uuid !== null && batch.data?.status === 10,
  })
  const save = useMutation({
    mutationFn: (input: { patch: BatchPatch }) => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      if (branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesBatchesApi.update(branchUuid, uuid, input.patch)
    },
    onSuccess: async () => {
      await refreshBatchCaches(client, captured, organizationId)
      if (!isBranchScopeCurrent(captured)) return
      // A corrected configuration invalidates the previous process rejection.
      process.reset()
      setRejectedPreviewAt(null)
      setMappingOpen(false)
      toast.success(t('operations:batches.detail.configSaved'))
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const saveExclusions = useMutation({
    mutationFn: (input: { rows: number[] }) => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      if (branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesBatchesApi.update(branchUuid, uuid, {
        excludedRows: input.rows,
      })
    },
    onSuccess: async () => {
      await refreshBatchCaches(client, captured, organizationId)
      if (!isBranchScopeCurrent(captured)) return
      // A corrected exclusion set invalidates the previous process rejection.
      process.reset()
      setRejectedPreviewAt(null)
      setExclusionEdits(null)
      toast.success(t('operations:batches.detail.exclusionsSaved'))
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const process = useMutation({
    mutationFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      if (branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesBatchesApi.process(branchUuid, uuid)
    },
    onSuccess: async () => {
      await refreshBatchCaches(client, captured, organizationId)
      if (!isBranchScopeCurrent(captured)) return
      toast.success(t('operations:batches.detail.processed'))
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      // Tie the rejected rows to the preview they were rejected against, so a
      // refetched preview supersedes them instead of keeping stale issues.
      setRejectedPreviewAt(preview.dataUpdatedAt)
      toast.error(errorMessage(caught))
    },
  })
  const destroy = useMutation({
    mutationFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      if (branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesBatchesApi.destroy(branchUuid, uuid)
    },
    onSuccess: async () => {
      await refreshBatchCaches(client, captured, organizationId)
      if (!isBranchScopeCurrent(captured)) return
      setDeleteOpen(false)
      toast.success(t('operations:batches.detail.deleted'))
      await navigate(
        organizationLocation(
          organizationSlug,
          captured.branchUuid,
          '/sales/batches'
        )
      )
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const download = useMutation({
    mutationFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return salesBatchesApi.download(branchUuid, uuid)
    },
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onError: (caught) => {
      if (!isBranchScopeCurrent(captured)) return
      toast.error(errorMessage(caught))
    },
  })

  const detailStatus =
    batch.error && axios.isAxiosError(batch.error)
      ? batch.error.response?.status
      : undefined
  const record = batch.data
  const analysis = preview.data
  // Process rejections belong in the matching row's issue cell, not a second
  // list above the table. They stay only while the preview they were computed
  // against is still the current one; a refetched preview supersedes them.
  const problems =
    rejectedPreviewAt !== null && rejectedPreviewAt === preview.dataUpdatedAt
      ? batchRowProblems(process.error)
      : []
  const processProblems = new Map(
    problems.map((problem) => [problem.row, problem.issues] as const)
  )
  const isDraft = record?.status === 10
  const excluded = exclusionEdits ?? analysis?.excludedRows ?? []
  const exclusionsDirty =
    exclusionEdits !== null &&
    analysis !== undefined &&
    JSON.stringify(exclusionEdits) !== JSON.stringify(analysis.excludedRows)

  function toggleExcluded(row: number, checked: boolean) {
    setExclusionEdits((current) => {
      const base = current ?? analysis?.excludedRows ?? []
      return checked
        ? [...new Set([...base, row])].sort((left, right) => left - right)
        : base.filter((value) => value !== row)
    })
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div className='space-y-1'>
          <div className='flex flex-wrap gap-4'>
            <Link
              {...organizationLocation(organizationSlug, branchUuid, '/sales')}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              {t('operations:batches.detail.backToSales')}
            </Link>
            <Link
              {...organizationLocation(
                organizationSlug,
                branchUuid,
                '/sales/batches'
              )}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              {t('operations:batches.detail.allBatches')}
            </Link>
          </div>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !batch.isError
              ? t('operations:batches.detail.titleWithReference', {
                  reference: record.reference || record.referenceInt,
                })
              : t('operations:batches.detail.title')}
          </h1>
        </div>
        {branch !== null && !branch.branch.active && (
          <BranchInactiveNotice branchName={branch.branch.name} />
        )}

        {uuid === null && (
          <p role='alert'>{t('operations:batches.detail.notFound')}</p>
        )}
        {uuid !== null && batch.isPending && (
          <p role='status'>{t('operations:batches.detail.loading')}</p>
        )}
        {uuid !== null && batch.isError && detailStatus === 404 && (
          <p role='alert'>
            {t('operations:batches.detail.notFoundOtherBranch')}
          </p>
        )}
        {uuid !== null && batch.isError && detailStatus !== 404 && (
          <p role='alert'>
            {t('operations:batches.detail.loadError')}{' '}
            <Button variant='outline' onClick={() => void batch.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}

        {record && !batch.isError && (
          <>
            <section className='space-y-2 rounded-md border border-border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <h2 className='text-xl font-semibold'>
                  {t('operations:batches.detail.sectionTitle')}
                </h2>
                <span className='text-sm text-muted-foreground'>
                  {batchStatusLabel(record.status)}
                </span>
              </div>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>{t('operations:batches.detail.fields.batch')}</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>{t('operations:batches.detail.fields.branch')}</dt>
                <dd>{record.branch.name}</dd>
                <dt>{t('operations:batches.detail.fields.businessDate')}</dt>
                <dd>{record.businessDate}</dd>
                <dt>{t('operations:batches.detail.fields.workbook')}</dt>
                <dd className='break-all'>{record.sourceFileName}</dd>
                <dt>{t('operations:batches.detail.fields.size')}</dt>
                <dd>
                  {t('operations:batches.detail.sizeBytes', {
                    size: record.sourceFileSize,
                  })}
                </dd>
                <dt>{t('operations:batches.detail.fields.uploaded')}</dt>
                <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
                <dt>{t('operations:batches.detail.fields.staff')}</dt>
                <dd>{record.createdByName}</dd>
                {record.processedAt != null && (
                  <>
                    <dt>{t('operations:batches.detail.fields.processed')}</dt>
                    <dd>
                      {new Date(record.processedAt).toLocaleString(locale)}
                    </dd>
                  </>
                )}
                <dt>{t('operations:batches.detail.fields.draftRows')}</dt>
                <dd>
                  {t('operations:batches.detail.draftRowsSummary', {
                    rows: record.rowCount,
                    quantity: record.quantityTotal,
                  })}
                </dd>
                <dt>{t('operations:batches.detail.fields.channels')}</dt>
                <dd>
                  {record.channels.length === 0
                    ? '—'
                    : record.channels.map((channel) => channel.name).join(', ')}
                </dd>
              </dl>
              <div className='flex flex-wrap gap-2 pt-2'>
                <Button
                  type='button'
                  variant='outline'
                  disabled={download.isPending}
                  onClick={() => download.mutate()}
                >
                  {download.isPending
                    ? t('operations:batches.detail.downloading')
                    : t('operations:batches.detail.download')}
                </Button>
                {isDraft && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={!writable || analysis === undefined}
                    onClick={() => setMappingOpen(true)}
                  >
                    {t('operations:batches.detail.configure')}
                  </Button>
                )}
                {isDraft && (
                  <Button
                    type='button'
                    disabled={
                      !writable ||
                      process.isPending ||
                      saveExclusions.isPending ||
                      analysis === undefined ||
                      !analysis.configured ||
                      analysis.blockingIssueCount > 0 ||
                      exclusionsDirty
                    }
                    onClick={() => process.mutate()}
                  >
                    {process.isPending
                      ? t('operations:batches.detail.processing')
                      : t('operations:batches.detail.process')}
                  </Button>
                )}
                <Button
                  type='button'
                  variant='destructive'
                  disabled={!writable}
                  onClick={() => setDeleteOpen(true)}
                >
                  {t('operations:batches.detail.delete')}
                </Button>
              </div>
              {isDraft && analysis && !analysis.configured && (
                <p className='text-sm text-muted-foreground'>
                  {t('operations:batches.detail.configureHint')}
                </p>
              )}
            </section>

            {process.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(process.error)}
              </p>
            )}
            {save.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(save.error)}
              </p>
            )}
            {saveExclusions.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(saveExclusions.error)}
              </p>
            )}
            {destroy.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(destroy.error)}
              </p>
            )}
            {download.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(download.error)}
              </p>
            )}

            {isDraft && analysis && (
              <DraftPreview
                analysis={analysis}
                processProblems={processProblems}
                excluded={excluded}
                pending={saveExclusions.isPending}
                disabled={!writable}
                onToggle={toggleExcluded}
                onSave={() =>
                  saveExclusions.mutate({
                    rows: excluded,
                  })
                }
              />
            )}

            {record.status === 20 && (
              <section className='space-y-2'>
                <h2 className='text-xl font-semibold'>
                  {t('operations:batches.detail.salesTitle')}
                </h2>
                {record.sales.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    {t('operations:batches.detail.salesEmpty')}
                  </p>
                ) : (
                  <Table>
                    <caption className='sr-only'>
                      {t('operations:batches.detail.salesCaption')}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t('operations:batches.detail.saleColumns.sale')}
                        </TableHead>
                        <TableHead>
                          {t('operations:batches.detail.saleColumns.recipe')}
                        </TableHead>
                        <TableHead>
                          {t('operations:batches.detail.saleColumns.channel')}
                        </TableHead>
                        <TableHead>
                          {t('operations:batches.detail.saleColumns.quantity')}
                        </TableHead>
                        <TableHead>
                          {t('operations:batches.detail.saleColumns.sourceRow')}
                        </TableHead>
                        <TableHead>
                          {t('operations:batches.detail.saleColumns.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.sales.map((sale) => (
                        <TableRow key={sale.uuid}>
                          <TableCell>{sale.reference}</TableCell>
                          <TableCell>{sale.recipeName}</TableCell>
                          <TableCell>{sale.channel?.name ?? '—'}</TableCell>
                          <TableCell>{sale.quantity}</TableCell>
                          <TableCell>{sale.sourceRow ?? '—'}</TableCell>
                          <TableCell>
                            <Link
                              {...organizationLocation(
                                organizationSlug,
                                record.branch.uuid,
                                '/sales/$saleId',
                                { saleId: sale.uuid }
                              )}
                              aria-label={t(
                                'operations:batches.detail.saleDetails',
                                {
                                  reference: sale.reference,
                                }
                              )}
                              className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                            >
                              {t(
                                'operations:batches.detail.saleColumns.details'
                              )}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            )}

            {record.status === 20 && (
              <BatchZReports
                batchUuid={record.uuid}
                branchUuid={record.branch.uuid}
              />
            )}

            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title={
                isDraft
                  ? t('operations:batches.detail.deleteDraftTitle')
                  : t('operations:batches.detail.deleteProcessedTitle')
              }
              desc={
                isDraft
                  ? t('operations:batches.detail.deleteDraftDescription')
                  : t('operations:batches.detail.deleteProcessedDescription')
              }
              confirmText={
                isDraft
                  ? t('operations:batches.detail.deleteDraftConfirm')
                  : t('operations:batches.detail.deleteProcessedConfirm')
              }
              destructive
              isLoading={destroy.isPending}
              handleConfirm={() => destroy.mutate()}
            />
          </>
        )}
      </Main>
      {mappingOpen && record && analysis && writable && (
        <BatchMapping
          detail={record}
          preview={analysis}
          branchUuid={record.branch.uuid}
          pending={save.isPending}
          error={save.error}
          onClose={() => setMappingOpen(false)}
          onSubmit={(patch) => save.mutate({ patch })}
        />
      )}
    </>
  )
}

function DraftPreview({
  analysis,
  processProblems,
  excluded,
  pending,
  disabled,
  onToggle,
  onSave,
}: {
  analysis: BatchPreview
  /** Per-row issues of the last rejected process attempt. */
  processProblems: ReadonlyMap<number, BatchIssue[]>
  excluded: number[]
  pending: boolean
  disabled: boolean
  onToggle: (row: number, checked: boolean) => void
  onSave: () => void
}) {
  const requirements = analysis.requirements
  const [rowPage, setRowPage] = useState(0)
  const pageSize = 50
  const pageCount = Math.max(1, Math.ceil(analysis.rows.length / pageSize))
  const safePage = Math.min(rowPage, pageCount - 1)
  const visibleRows = analysis.rows.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  )
  return (
    <>
      {analysis.modpos !== null && (
        <section className='space-y-2 rounded-md border border-border p-4'>
          <h2 className='text-xl font-semibold'>
            {t('operations:batches.preview.modposTitle')}
          </h2>
          <p className='text-sm text-muted-foreground'>
            {t('operations:batches.preview.modposDescription', {
              sheet: analysis.modpos.sheetName,
              headerRow: analysis.modpos.headerRow,
            })}
          </p>
          {analysis.modpos.dateFrom !== null && (
            <p className='text-sm text-muted-foreground'>
              {t('operations:batches.preview.modposDate', {
                from: analysis.modpos.dateFrom,
                to: analysis.modpos.dateTo ?? analysis.modpos.dateFrom,
              })}
            </p>
          )}
          <ul className='list-disc space-y-1 ps-5 text-sm text-muted-foreground'>
            {analysis.modpos.notes.map((note) => (
              <li key={note.code}>{batchIssueLabel(note)}</li>
            ))}
          </ul>
        </section>
      )}
      <section className='space-y-2'>
        <h2 className='text-xl font-semibold'>
          {t('operations:batches.preview.title')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('operations:batches.preview.summary', {
            included: analysis.includedRows,
            quantity: analysis.saleQuantity,
            excluded: analysis.excludedRowsCount,
            empty: analysis.emptyRowCount,
            blocking: analysis.blockingIssueCount,
            currency:
              analysis.currencyCode ??
              t('operations:batches.preview.unsetCurrency'),
            truncated: analysis.rowsTruncated
              ? t('operations:batches.preview.truncatedSuffix')
              : '',
          })}
        </p>
        <p className='text-sm text-muted-foreground'>
          {t('operations:batches.preview.explanation')}
        </p>
        {analysis.channels.length > 0 && (
          <div className='flex flex-wrap gap-2 text-sm'>
            {analysis.channels.map((channel) => (
              <span
                key={channel.sourceValue}
                className='rounded-md border border-border px-2 py-1'
              >
                {t('operations:batches.preview.channelChip', {
                  source: channel.sourceValue,
                  rows: channel.rows,
                  quantity: channel.quantity,
                  mapped: channel.channelName
                    ? t('operations:batches.preview.channelMapped', {
                        channel: channel.channelName,
                      })
                    : '',
                })}
              </span>
            ))}
          </div>
        )}
        <div className='flex justify-end'>
          <Button
            type='button'
            variant='outline'
            disabled={pending || disabled}
            onClick={onSave}
          >
            {pending
              ? t('operations:batches.preview.saving')
              : t('operations:batches.preview.saveExclusions')}
          </Button>
        </div>
        <div className='overflow-x-auto rounded-md border border-border'>
          <Table>
            <caption className='sr-only'>
              {t('operations:batches.preview.caption')}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('operations:batches.preview.columns.exclude')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.code')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.channel')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.product')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.quantity')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.recipe')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.unitPrice')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.lineTotal')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.preview.columns.issues')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <PreviewRow
                  key={row.row}
                  row={row}
                  processIssues={processProblems.get(row.row) ?? []}
                  analysisCurrency={analysis.currencyCode}
                  excluded={excluded.includes(row.row)}
                  disabled={disabled}
                  onToggle={(checked) => onToggle(row.row, checked)}
                />
              ))}
              {analysis.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
                    {t('operations:batches.preview.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <Button
            type='button'
            variant='outline'
            disabled={safePage === 0}
            onClick={() => setRowPage((page) => Math.max(0, page - 1))}
          >
            {t('operations:batches.preview.previousRows')}
          </Button>
          <span>
            {t('operations:batches.preview.rowRange', {
              from: safePage * pageSize + 1,
              to: Math.min((safePage + 1) * pageSize, analysis.rows.length),
              total: analysis.rows.length,
            })}
          </span>
          <Button
            type='button'
            variant='outline'
            disabled={safePage + 1 >= pageCount}
            onClick={() => setRowPage((page) => page + 1)}
          >
            {t('operations:batches.preview.nextRows')}
          </Button>
        </div>
      </section>

      <section className='space-y-2'>
        <h2 className='text-xl font-semibold'>
          {t('operations:batches.requirements.title')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('operations:batches.requirements.description', {
            branch: analysis.branch.name,
          })}
        </p>
        {requirements.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            {t('operations:batches.requirements.empty')}
          </p>
        ) : (
          <Table>
            <caption className='sr-only'>
              {t('operations:batches.requirements.caption')}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('operations:batches.requirements.columns.item')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.requirements.columns.required')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.requirements.columns.available')}
                </TableHead>
                <TableHead>
                  {t('operations:batches.requirements.columns.missing')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requirements.map((requirement) => (
                <TableRow key={requirement.itemUuid}>
                  <TableCell>{requirement.itemName}</TableCell>
                  <TableCell>
                    {requirement.required} {requirement.itemUnits}
                  </TableCell>
                  <TableCell>{requirement.available}</TableCell>
                  <TableCell>
                    {requirement.missing === '0'
                      ? '—'
                      : `${requirement.missing} ${requirement.itemUnits}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  )
}

function PreviewRow({
  row,
  processIssues,
  analysisCurrency,
  excluded,
  disabled,
  onToggle,
}: {
  row: BatchPreviewRow
  processIssues: BatchIssue[]
  analysisCurrency: string | null
  excluded: boolean
  disabled: boolean
  onToggle: (checked: boolean) => void
}) {
  // The same problem can arrive from the preview and from the rejected process
  // attempt; one line per issue keeps the cell readable.
  const issues = [...row.issues, ...processIssues].filter(
    (issue, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.code === issue.code && candidate.message === issue.message
      ) === index
  )
  return (
    <TableRow>
      <TableCell>
        <input
          type='checkbox'
          aria-label={t('operations:batches.preview.excludeRowLabel', {
            row: row.row,
          })}
          checked={excluded}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
          className='size-4'
        />
      </TableCell>
      <TableCell>{row.productCode || '—'}</TableCell>
      <TableCell>
        {row.channelValue || '—'}
        {row.channelName ? ` → ${row.channelName}` : ''}
      </TableCell>
      <TableCell>
        {row.productValue || row.productCode || '—'}
        {row.recipeName ? ` → ${row.recipeName}` : ''}
      </TableCell>
      <TableCell>
        {row.quantityRaw || '—'}
        {row.quantity !== null ? ` (${row.quantity})` : ''}
      </TableCell>
      <TableCell>{row.recipeName ?? '—'}</TableCell>
      <TableCell>
        {row.unitPrice === null
          ? '—'
          : `${row.unitPrice} ${analysisCurrency ?? ''}`.trim()}
      </TableCell>
      <TableCell>
        {row.lineTotal === null
          ? '—'
          : `${row.lineTotal} ${analysisCurrency ?? ''}`.trim()}
      </TableCell>
      <TableCell>
        {excluded ? (
          t('operations:batches.preview.excluded')
        ) : issues.length === 0 ? (
          '—'
        ) : (
          <ul className='space-y-1'>
            {issues.map((issue) => (
              <li key={`${issue.code}:${issue.message}`}>
                {batchIssueLabel(issue)}
              </li>
            ))}
          </ul>
        )}
      </TableCell>
    </TableRow>
  )
}
