import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
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
import { errorMessage, posDevicesApi, zReportsApi } from '../api'
import { ReportForm } from '../components/report-form'
import type { ZReport, ZReportInput } from '../model'

const deviceRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/$deviceId'
)

function reportColumns(organizationSlug: string): SortableColumn<ZReport>[] {
  return [
    {
      id: 'number',
      header: 'Report',
      accessorFn: (report) => report.reportNumber,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'businessDate',
      header: 'Business date',
      accessorFn: (report) => report.businessDate,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'closedAt',
      header: 'Closed',
      accessorFn: (report) => new Date(report.closedAt).getTime(),
      cell: ({ row }) => new Date(row.original.closedAt).toLocaleString(),
    },
    {
      id: 'amount',
      header: 'Total',
      // Exact decimal strings are not compared as numbers here.
      enableSorting: false,
      accessorFn: (report) => report.totalAmount,
      cell: ({ row }) =>
        `${row.original.totalAmount} ${row.original.currencyCode}`,
    },
    {
      id: 'batch',
      header: 'Sales batch',
      accessorFn: (report) =>
        report.salesBatch?.reference || report.salesBatch?.uuid || '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to='/o/$organizationSlug/pos-devices/$deviceId/z-reports/$reportId'
          params={{
            organizationSlug,
            deviceId: row.original.posDevice.uuid,
            reportId: row.original.uuid,
          }}
          aria-label={`Details for Z report ${row.original.reportNumber}`}
          className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Details
        </Link>
      ),
    },
  ]
}

export function ZReportsPage() {
  const { deviceId } = deviceRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const deviceUuid = parseResourceUuid(deviceId)
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const columns = useMemo(
    () => reportColumns(organizationSlug),
    [organizationSlug]
  )
  const device = useQuery({
    queryKey: ['pos-devices', scope, 'detail', deviceUuid],
    queryFn: () => {
      if (deviceUuid === null) throw new Error('POS device uuid is required')
      return posDevicesApi.get(deviceUuid)
    },
    enabled: deviceUuid !== null,
  })
  const reports = useQuery({
    queryKey: [
      'pos-devices',
      scope,
      'reports',
      'list',
      deviceUuid,
      page,
      search,
    ],
    queryFn: () => {
      if (deviceUuid === null) throw new Error('POS device uuid is required')
      return zReportsApi.list({
        page,
        search,
        posDeviceUuid: deviceUuid,
      })
    },
    enabled: deviceUuid !== null,
  })
  const create = useMutation({
    mutationFn: (input: { body: ZReportInput; scope: string }) => {
      if (deviceUuid === null) throw new Error('POS device uuid is required')
      return zReportsApi.create(deviceUuid, input.body)
    },
    onSuccess: async (_report, input) => {
      setCreating(false)
      await client.invalidateQueries({
        queryKey: ['pos-devices', input.scope],
      })
      toast.success('Z report created')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const detailStatus =
    device.error && axios.isAxiosError(device.error)
      ? device.error.response?.status
      : undefined
  const record = device.data
  const data = reports.data

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
              to='/o/$organizationSlug/pos-devices'
              params={{ organizationSlug }}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              Back to bank POS devices
            </Link>
            {deviceUuid !== null && (
              <Link
                to='/o/$organizationSlug/pos-devices/$deviceId'
                params={{ organizationSlug, deviceId: deviceUuid }}
                className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                Device
              </Link>
            )}
          </div>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !device.isError
              ? `Z reports · ${record.name}`
              : 'Z reports'}
          </h1>
          <p className='text-muted-foreground'>
            Bank POS end-of-day reports for this device. Linking a processed
            sales batch is optional evidence: one report links to at most one
            batch, a batch may have several reports, and coverage may be
            partial. No sale is recorded and no finance entry is written.
          </p>
        </div>

        {deviceUuid === null && <p role='alert'>Bank POS device not found.</p>}
        {deviceUuid !== null && device.isPending && (
          <p role='status'>Loading bank POS device…</p>
        )}
        {deviceUuid !== null && device.isError && detailStatus === 404 && (
          <p role='alert'>Bank POS device not found.</p>
        )}
        {deviceUuid !== null && device.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(device.error)}{' '}
            <Button variant='outline' onClick={() => void device.refetch()}>
              Retry
            </Button>
          </p>
        )}

        {record && !device.isError && (
          <div className='space-y-4'>
            <div className='flex justify-end'>
              <Button
                type='button'
                onClick={() => {
                  create.reset()
                  setCreating(true)
                }}
              >
                New Z report
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
                aria-label='Search Z reports'
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder='Search Z reports'
                maxLength={100}
                className='max-w-sm'
              />
              <Button variant='outline'>Find</Button>
            </form>
            {reports.isPending && <p role='status'>Loading Z reports…</p>}
            {reports.isError && (
              <p role='alert'>
                {errorMessage(reports.error)}{' '}
                <Button
                  variant='outline'
                  onClick={() => void reports.refetch()}
                >
                  Retry
                </Button>
              </p>
            )}
            {data && (
              <>
                <p className='text-sm text-muted-foreground'>
                  {data.total} Z reports. Sorting applies to this page only.
                </p>
                <SortableDataTable
                  data={data.items}
                  columns={columns}
                  getRowId={(report) => report.uuid}
                  caption='Z reports for this bank POS device'
                  emptyMessage={
                    search
                      ? 'No Z reports match this search.'
                      : data.total > 0
                        ? 'No Z reports on this page.'
                        : 'This device has no Z reports yet.'
                  }
                />
              </>
            )}
            <PageControls
              page={page}
              loading={reports.isFetching}
              hasNext={!!data && (page + 1) * data.limit < data.total}
              onChange={setPage}
            />
          </div>
        )}
      </Main>
      {creating && deviceUuid !== null && (
        <ReportForm
          report='new'
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={(body) => create.mutate({ body, scope })}
        />
      )}
    </>
  )
}
