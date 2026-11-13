import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, salesBatchesApi } from './api'
import { BatchUpload } from './components/batch-upload'
import type { BatchSummary } from './model'

function statusLabel(status: number) {
  if (status === 10) return 'Draft'
  if (status === 20) return 'Processed'
  return String(status)
}

function batchColumns(
  organizationSlug: string
): SortableColumn<BatchSummary>[] {
  return [
    {
      id: 'reference',
      header: 'Batch',
      accessorFn: (batch) => batch.reference || batch.referenceInt,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'businessDate',
      header: 'Sale date',
      accessorFn: (batch) => batch.businessDate,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'sourceFileName',
      header: 'Workbook',
      accessorFn: (batch) => batch.sourceFileName,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'status',
      header: 'State',
      accessorFn: (batch) => statusLabel(batch.status),
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'channels',
      header: 'Channels',
      accessorFn: (batch) => batch.channels.map((ch) => ch.name).join(', '),
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'rows',
      header: 'Rows',
      accessorFn: (batch) => batch.rowCount,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorFn: (batch) => batch.quantityTotal,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      accessorFn: (batch) => new Date(batch.createdAt).getTime(),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const batch = row.original
        return (
          <Link
            to='/o/$organizationSlug/sales/batches/$batchId'
            params={{ organizationSlug, batchId: batch.uuid }}
            aria-label={`Details for batch ${
              batch.reference || batch.referenceInt
            }`}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        )
      },
    },
  ]
}

export function SalesBatchesPage() {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const columns = useMemo(
    () => batchColumns(organizationSlug),
    [organizationSlug]
  )
  const scope = organizationCacheScope()
  const batches = useQuery({
    queryKey: ['sales', scope, 'batches', 'list', page, search],
    queryFn: () => salesBatchesApi.list({ page, search }),
  })
  const upload = useMutation({
    mutationFn: (input: { file: File; scope: string }) =>
      salesBatchesApi.upload(input.file),
    onSuccess: async (batch, input) => {
      setUploading(false)
      await client.invalidateQueries({
        queryKey: ['sales', input.scope, 'batches'],
      })
      toast.success('Workbook uploaded as a draft batch')
      await navigate({
        to: '/o/$organizationSlug/sales/batches/$batchId',
        params: { organizationSlug, batchId: batch.uuid },
      })
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const data = batches.data
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
          <h1 className='mt-2 text-2xl font-bold'>Sales batches</h1>
          <p className='text-muted-foreground'>
            Uploaded workbooks stay as drafts until every row is mapped and the
            batch is processed. Uploading the same file again creates an
            independent batch.
          </p>
        </div>
        <div className='space-y-4'>
          <div className='flex justify-end'>
            <Button type='button' onClick={() => setUploading(true)}>
              Upload workbook
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
              aria-label='Search sales batches'
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder='Search batches'
              maxLength={100}
              className='max-w-sm'
            />
            <Button variant='outline'>Find</Button>
          </form>
          {batches.isPending && <p role='status'>Loading batches…</p>}
          {batches.isError && (
            <p role='alert'>
              {errorMessage(batches.error)}{' '}
              <Button variant='outline' onClick={() => void batches.refetch()}>
                Retry
              </Button>
            </p>
          )}
          {data && (
            <>
              <p className='text-sm text-muted-foreground'>
                {data.total} batches. Sorting applies to this page only.
              </p>
              <SortableDataTable
                data={data.items}
                columns={columns}
                getRowId={(batch) => batch.uuid}
                caption='Uploaded sales batches'
                emptyMessage='No batches match this search.'
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
      </Main>
      {uploading && (
        <BatchUpload
          pending={upload.isPending}
          error={upload.error}
          onClose={() => setUploading(false)}
          onSubmit={(file) =>
            upload.mutate({ file, scope: organizationCacheScope() })
          }
        />
      )}
    </>
  )
}
