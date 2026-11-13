import { useState } from 'react'
import axios from 'axios'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
import {
  useOrganizationBoundary,
  useOrganizationSlug,
} from '@/lib/organization-boundary'
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
import { batchRowProblems, errorMessage, salesBatchesApi } from './api'
import { BatchMapping } from './components/batch-mapping'
import type { BatchPatch, BatchPreview, BatchPreviewRow } from './model'

const batchRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/sales/batches/$batchId'
)

function statusLabel(status: number) {
  if (status === 10) return 'Draft'
  if (status === 20) return 'Processed'
  return String(status)
}

async function refreshBatchCaches(
  client: QueryClient,
  scope: string,
  organizationId: string
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['sales', scope] }),
    invalidateItemStockCaches(client, scope),
    client.invalidateQueries({
      queryKey: ['dashboard', 'builder', 'organization', organizationId],
    }),
  ])
}

export function SalesBatchDetail() {
  const { batchId } = batchRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const { organizationId } = useOrganizationBoundary()
  const client = useQueryClient()
  const navigate = useNavigate()
  const uuid = parseResourceUuid(batchId)
  const scope = organizationCacheScope()
  const [mappingOpen, setMappingOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exclusionEdits, setExclusionEdits] = useState<number[] | null>(null)

  const batch = useQuery({
    queryKey: ['sales', scope, 'batches', 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.get(uuid)
    },
    enabled: uuid !== null,
  })
  const preview = useQuery({
    queryKey: ['sales', scope, 'batches', 'preview', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.preview(uuid)
    },
    enabled: uuid !== null && batch.data?.status === 10,
  })
  const save = useMutation({
    mutationFn: (input: { patch: BatchPatch; scope: string }) => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.update(uuid, input.patch)
    },
    onSuccess: async (_detail, input) => {
      setMappingOpen(false)
      await refreshBatchCaches(client, input.scope, organizationId)
      toast.success('Batch configuration saved')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const saveExclusions = useMutation({
    mutationFn: (input: { rows: number[]; scope: string }) => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.update(uuid, { excludedRows: input.rows })
    },
    onSuccess: async (_detail, input) => {
      setExclusionEdits(null)
      await refreshBatchCaches(client, input.scope, organizationId)
      toast.success('Excluded rows saved')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const process = useMutation({
    mutationFn: () => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.process(uuid)
    },
    onSuccess: async () => {
      await refreshBatchCaches(client, scope, organizationId)
      toast.success('Batch processed')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const destroy = useMutation({
    mutationFn: () => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.destroy(uuid)
    },
    onSuccess: async () => {
      setDeleteOpen(false)
      await refreshBatchCaches(client, scope, organizationId)
      toast.success('Batch deleted')
      await navigate({
        to: '/o/$organizationSlug/sales/batches',
        params: { organizationSlug },
      })
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const download = useMutation({
    mutationFn: () => {
      if (uuid === null) throw new Error('Batch uuid is required')
      return salesBatchesApi.download(uuid)
    },
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })

  const detailStatus =
    batch.error && axios.isAxiosError(batch.error)
      ? batch.error.response?.status
      : undefined
  const record = batch.data
  const analysis = preview.data
  const problems = batchRowProblems(process.error)
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
              to='/o/$organizationSlug/sales'
              params={{ organizationSlug }}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              Back to sales
            </Link>
            <Link
              to='/o/$organizationSlug/sales/batches'
              params={{ organizationSlug }}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              All batches
            </Link>
          </div>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !batch.isError
              ? `Batch ${record.reference || record.referenceInt}`
              : 'Sales batch'}
          </h1>
        </div>

        {uuid === null && <p role='alert'>Batch not found.</p>}
        {uuid !== null && batch.isPending && (
          <p role='status'>Loading batch…</p>
        )}
        {uuid !== null && batch.isError && detailStatus === 404 && (
          <p role='alert'>Batch not found.</p>
        )}
        {uuid !== null && batch.isError && detailStatus !== 404 && (
          <p role='alert'>
            Could not load this batch.{' '}
            <Button variant='outline' onClick={() => void batch.refetch()}>
              Retry
            </Button>
          </p>
        )}

        {record && !batch.isError && (
          <>
            <section className='space-y-2 rounded-md border border-border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <h2 className='text-xl font-semibold'>Batch details</h2>
                <span className='text-sm text-muted-foreground'>
                  {statusLabel(record.status)}
                </span>
              </div>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>Batch</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>Sale date</dt>
                <dd>{record.businessDate}</dd>
                <dt>Workbook</dt>
                <dd className='break-all'>{record.sourceFileName}</dd>
                <dt>Size</dt>
                <dd>{record.sourceFileSize} bytes</dd>
                <dt>Uploaded</dt>
                <dd>{new Date(record.createdAt).toLocaleString()}</dd>
                <dt>Staff</dt>
                <dd>{record.createdByName}</dd>
                {record.processedAt != null && (
                  <>
                    <dt>Processed</dt>
                    <dd>{new Date(record.processedAt).toLocaleString()}</dd>
                  </>
                )}
                <dt>Draft rows</dt>
                <dd>
                  {record.rowCount} rows · {record.quantityTotal} quantity
                </dd>
                <dt>Channels</dt>
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
                    ? 'Downloading…'
                    : 'Download original workbook'}
                </Button>
                {isDraft && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={analysis === undefined}
                    onClick={() => setMappingOpen(true)}
                  >
                    Configure workbook
                  </Button>
                )}
                {isDraft && (
                  <Button
                    type='button'
                    disabled={
                      process.isPending ||
                      saveExclusions.isPending ||
                      analysis === undefined ||
                      !analysis.configured ||
                      analysis.blockingIssueCount > 0 ||
                      exclusionsDirty
                    }
                    onClick={() => process.mutate()}
                  >
                    {process.isPending ? 'Processing…' : 'Process batch'}
                  </Button>
                )}
                <Button
                  type='button'
                  variant='destructive'
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete batch
                </Button>
              </div>
              {isDraft && analysis && !analysis.configured && (
                <p className='text-sm text-muted-foreground'>
                  Configure the worksheet, header row and source columns before
                  this draft can be processed.
                </p>
              )}
            </section>

            {process.isError && (
              <div role='alert' className='space-y-2 text-sm text-destructive'>
                <p>{errorMessage(process.error)}</p>
                {problems.length > 0 && (
                  <ul className='space-y-1'>
                    {problems.map((problem) => (
                      <li key={problem.row}>
                        Row {problem.row}
                        {problem.product ? ` · ${problem.product}` : ''}:{' '}
                        {problem.issues
                          .map((issue) => issue.message)
                          .join('; ')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                excluded={excluded}
                pending={saveExclusions.isPending}
                onToggle={toggleExcluded}
                onSave={() =>
                  saveExclusions.mutate({
                    rows: excluded,
                    scope: organizationCacheScope(),
                  })
                }
              />
            )}

            {record.status === 20 && (
              <section className='space-y-2'>
                <h2 className='text-xl font-semibold'>Recorded sales</h2>
                {record.sales.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    This batch did not record any sale.
                  </p>
                ) : (
                  <Table>
                    <caption className='sr-only'>
                      Sales recorded by this batch
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale</TableHead>
                        <TableHead>Recipe</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Source row</TableHead>
                        <TableHead>Actions</TableHead>
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
                              to='/o/$organizationSlug/sales/$saleId'
                              params={{
                                organizationSlug,
                                saleId: sale.uuid,
                              }}
                              aria-label={`Details for sale ${sale.reference}`}
                              className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                            >
                              Details
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            )}

            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title={
                isDraft ? 'Delete draft batch?' : 'Delete processed batch?'
              }
              desc={
                isDraft
                  ? 'The draft and its stored workbook are removed. Stock is not changed.'
                  : 'This reverses exactly the stock consumed by this batch, removes its sales and deletes the batch. Other sales are untouched.'
              }
              confirmText={
                isDraft ? 'Delete draft' : 'Delete and reverse stock'
              }
              destructive
              isLoading={destroy.isPending}
              handleConfirm={() => destroy.mutate()}
            />
          </>
        )}
      </Main>
      {mappingOpen && record && analysis && (
        <BatchMapping
          detail={record}
          preview={analysis}
          pending={save.isPending}
          error={save.error}
          onClose={() => setMappingOpen(false)}
          onSubmit={(patch) =>
            save.mutate({ patch, scope: organizationCacheScope() })
          }
        />
      )}
    </>
  )
}

function DraftPreview({
  analysis,
  excluded,
  pending,
  onToggle,
  onSave,
}: {
  analysis: BatchPreview
  excluded: number[]
  pending: boolean
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
      <section className='space-y-2'>
        <h2 className='text-xl font-semibold'>Workbook preview</h2>
        <p className='text-sm text-muted-foreground'>
          {analysis.includedRows} included rows · {analysis.saleQuantity} parsed
          quantity · {analysis.excludedRowsCount} excluded ·{' '}
          {analysis.emptyRowCount} empty rows skipped ·{' '}
          {analysis.blockingIssueCount} rows with blocking issues
          {analysis.rowsTruncated
            ? ' · the preview is truncated; reduce the worksheet or contact support'
            : ''}
        </p>
        {analysis.channels.length > 0 && (
          <div className='flex flex-wrap gap-2 text-sm'>
            {analysis.channels.map((channel) => (
              <span
                key={channel.sourceValue}
                className='rounded-md border border-border px-2 py-1'
              >
                {channel.sourceValue}: {channel.rows} rows / {channel.quantity}
                {channel.channelName ? ` → ${channel.channelName}` : ''}
              </span>
            ))}
          </div>
        )}
        <div className='flex justify-end'>
          <Button
            type='button'
            variant='outline'
            disabled={pending}
            onClick={onSave}
          >
            {pending ? 'Saving…' : 'Save excluded rows'}
          </Button>
        </div>
        <div className='overflow-x-auto rounded-md border border-border'>
          <Table>
            <caption className='sr-only'>
              Parsed workbook rows and their validation issues
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Exclude</TableHead>
                <TableHead>Row</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Mapped recipe</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <PreviewRow
                  key={row.row}
                  row={row}
                  excluded={excluded.includes(row.row)}
                  onToggle={(checked) => onToggle(row.row, checked)}
                />
              ))}
              {analysis.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    No data rows were found below the header row.
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
            Previous rows
          </Button>
          <span>
            Rows {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, analysis.rows.length)} of{' '}
            {analysis.rows.length}
          </span>
          <Button
            type='button'
            variant='outline'
            disabled={safePage + 1 >= pageCount}
            onClick={() => setRowPage((page) => page + 1)}
          >
            Next rows
          </Button>
        </div>
      </section>

      <section className='space-y-2'>
        <h2 className='text-xl font-semibold'>Material requirements</h2>
        <p className='text-sm text-muted-foreground'>
          Requirements are summed across every included row before any stock is
          changed.
        </p>
        {requirements.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No material requirements can be planned yet.
          </p>
        ) : (
          <Table>
            <caption className='sr-only'>
              Aggregated material requirements for this batch
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Missing</TableHead>
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
  excluded,
  onToggle,
}: {
  row: BatchPreviewRow
  excluded: boolean
  onToggle: (checked: boolean) => void
}) {
  return (
    <TableRow>
      <TableCell>
        <input
          type='checkbox'
          aria-label={`Exclude row ${row.row}`}
          checked={excluded}
          onChange={(event) => onToggle(event.target.checked)}
          className='size-4'
        />
      </TableCell>
      <TableCell>{row.row}</TableCell>
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
        {excluded ? (
          'Excluded'
        ) : row.issues.length === 0 ? (
          '—'
        ) : (
          <ul className='space-y-1'>
            {row.issues.map((issue) => (
              <li key={`${issue.code}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        )}
      </TableCell>
    </TableRow>
  )
}
