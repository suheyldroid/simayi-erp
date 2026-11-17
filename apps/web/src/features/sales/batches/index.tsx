import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch, type BranchContext } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationLocation } from '@/lib/organization-navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, salesBatchesApi } from './api'
import { BatchUpload } from './components/batch-upload'
import { batchStatusLabel, type BatchSummary } from './model'

function batchColumns(
  organizationSlug: string,
  companyMode: boolean
): SortableColumn<BatchSummary>[] {
  return [
    {
      id: 'reference',
      header: t('operations:batches.list.columns.reference'),
      accessorFn: (batch) => batch.reference || batch.referenceInt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    ...(companyMode
      ? [
          {
            id: 'branch',
            header: t('operations:batches.list.columns.branch'),
            accessorFn: (batch: BatchSummary) => batch.branch.name,
            cell: ({ row }: { row: { original: BatchSummary } }) =>
              row.original.branch.name,
          } satisfies SortableColumn<BatchSummary>,
        ]
      : []),
    {
      id: 'businessDate',
      header: t('operations:batches.list.columns.businessDate'),
      accessorFn: (batch) => batch.businessDate,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'sourceFileName',
      header: t('operations:batches.list.columns.workbook'),
      accessorFn: (batch) => batch.sourceFileName,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'status',
      header: t('operations:batches.list.columns.state'),
      accessorFn: (batch) => batchStatusLabel(batch.status),
      cell: ({ row }) => batchStatusLabel(row.original.status),
    },
    {
      id: 'channels',
      header: t('operations:batches.list.columns.channels'),
      accessorFn: (batch) => batch.channels.map((ch) => ch.name).join(', '),
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'rows',
      header: t('operations:batches.list.columns.rows'),
      accessorFn: (batch) => batch.rowCount,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'quantity',
      header: t('operations:batches.list.columns.quantity'),
      accessorFn: (batch) => batch.quantityTotal,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'uploaded',
      header: t('operations:batches.list.columns.uploaded'),
      accessorFn: (batch) => new Date(batch.createdAt).getTime(),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleString(locale),
    },
    {
      id: 'actions',
      header: t('operations:batches.list.columns.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const batch = row.original
        return (
          <Link
            {...organizationLocation(
              organizationSlug,
              batch.branch.uuid,
              '/sales/batches/$batchId',
              { batchId: batch.uuid }
            )}
            aria-label={t('operations:batches.list.detailsLabel', {
              reference: batch.reference || batch.referenceInt,
            })}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:batches.list.details')}
          </Link>
        )
      },
    },
  ]
}

/**
 * Company context lists every branch's batches; a branch path lists exactly
 * its own uploaded batches. Uploading stays a branch-only operation because a
 * batch is pinned to the branch it was uploaded into.
 */
export function SalesBatchesPage() {
  const branch = useOptionalBranch()
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='mt-2 text-2xl font-bold'>
            {t('operations:batches.index.title')}
          </h1>
          <p className='text-muted-foreground'>
            {branch === null
              ? t('operations:batches.index.companyDescription')
              : t('operations:batches.index.description', {
                  branch: branch.branch.name,
                })}
          </p>
        </div>
        {branch !== null && !branch.branch.active && (
          <BranchInactiveNotice branchName={branch.branch.name} />
        )}
        <SalesBatchDirectory branch={branch} />
      </Main>
    </>
  )
}

function SalesBatchDirectory({ branch }: { branch: BranchContext | null }) {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const branchUuid = branch?.branchUuid ?? null
  const companyMode = branchUuid === null
  const scopeKey = branchCacheScope(branchUuid)
  const writable = branch !== null && branch.branch.active
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const columns = useMemo(
    () => batchColumns(organizationSlug, companyMode),
    [organizationSlug, companyMode]
  )
  const batches = useQuery({
    queryKey: ['sales', scopeKey, 'batches', 'list', page, search, branchUuid],
    queryFn: () => salesBatchesApi.list({ branchUuid, page, search }),
  })
  const upload = useMutation({
    mutationFn: (input: { file: File; captured: CapturedBranchScope }) => {
      if (input.captured.branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return salesBatchesApi.upload(input.captured.branchUuid, input.file)
    },
    onSuccess: async (batch, input) => {
      const companyScope = `${input.captured.organizationScope}::company`
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['sales', input.captured.scope, 'batches'],
        }),
        client.invalidateQueries({
          queryKey: ['sales', companyScope, 'batches'],
        }),
      ])
      if (!isBranchScopeCurrent(input.captured)) return
      setUploading(false)
      toast.success(t('operations:batches.list.uploaded'))
      const owningBranchUuid = input.captured.branchUuid
      if (owningBranchUuid === null) return
      await navigate({
        to: '/o/$organizationSlug/b/$branchUuid/sales/batches/$batchId',
        params: {
          organizationSlug,
          branchUuid: owningBranchUuid,
          batchId: batch.uuid,
        },
      })
    },
    onError: (caught, input) => {
      if (!isBranchScopeCurrent(input.captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const data = batches.data
  return (
    <>
      <div className='space-y-4'>
        <div className='flex justify-end'>
          <Button
            type='button'
            disabled={!writable}
            title={
              companyMode
                ? t('operations:batches.list.selectBranchForUpload')
                : undefined
            }
            onClick={() => setUploading(true)}
          >
            {t('operations:batches.list.upload')}
          </Button>
        </div>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label={t('operations:batches.list.searchLabel')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('operations:batches.list.searchPlaceholder')}
            maxLength={100}
            className='max-w-sm'
          />
          <Button variant='outline'>{t('operations:common.find')}</Button>
        </form>
        {batches.isPending && (
          <p role='status'>{t('operations:batches.list.loading')}</p>
        )}
        {batches.isError && (
          <p role='alert'>
            {errorMessage(batches.error)}{' '}
            <Button variant='outline' onClick={() => void batches.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}
        {data && (
          <>
            <p className='text-sm text-muted-foreground'>
              {companyMode
                ? t('operations:batches.list.totalCompany', {
                    count: data.total.toLocaleString(locale),
                  })
                : t('operations:batches.list.total', {
                    count: data.total.toLocaleString(locale),
                    branch: branch?.branch.name ?? '',
                  })}
            </p>
            <SortableDataTable
              data={data.items}
              columns={columns}
              getRowId={(batch) => batch.uuid}
              caption={
                companyMode
                  ? t('operations:batches.list.captionCompany')
                  : t('operations:batches.list.caption', {
                      branch: branch?.branch.name ?? '',
                    })
              }
              emptyMessage={
                search
                  ? t('operations:batches.list.empty')
                  : companyMode
                    ? t('operations:batches.list.emptyCompany')
                    : t('operations:batches.list.empty')
              }
            />
          </>
        )}
        <PageControls
          page={page}
          loading={batches.isFetching}
          hasNext={!!data && (page + 1) * data.limit < data.total}
          onChange={setPage}
        />
      </div>
      {uploading && writable && branch !== null && (
        <BatchUpload
          branchName={branch.branch.name}
          pending={upload.isPending}
          error={upload.error}
          onClose={() => {
            setUploading(false)
            upload.reset()
          }}
          onSubmit={(file) =>
            upload.mutate({
              file,
              captured: captureBranchScope(branchUuid),
            })
          }
        />
      )}
    </>
  )
}
