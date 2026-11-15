import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, zReportsApi } from '../api'
import { ReportForm } from '../components/report-form'
import type { ZReport, ZReportInput } from '../model'

const reportRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/$deviceId/z-reports/$reportId'
)

export function ZReportDetail() {
  const { deviceId, reportId } = reportRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const deviceUuid = parseResourceUuid(deviceId)
  const reportUuid = parseResourceUuid(reportId)
  const [editing, setEditing] = useState<ZReport | null>(null)
  const report = useQuery({
    queryKey: [
      'pos-devices',
      scope,
      'reports',
      'detail',
      deviceUuid,
      reportUuid,
    ],
    queryFn: () => {
      if (deviceUuid === null || reportUuid === null)
        throw new Error('Z report uuid is required')
      return zReportsApi.get(deviceUuid, reportUuid)
    },
    enabled: deviceUuid !== null && reportUuid !== null,
  })
  const update = useMutation({
    mutationFn: (input: {
      body: ZReportInput
      version: number
      target: { deviceUuid: string; reportUuid: string }
      scope: string
    }) =>
      zReportsApi.update(input.target.deviceUuid, input.target.reportUuid, {
        ...input.body,
        version: input.version,
      }),
    onSuccess: async (_report, input) => {
      setEditing(null)
      // Attaching or detaching a batch also changes the batch's report list.
      await client.invalidateQueries({
        queryKey: ['pos-devices', input.scope],
      })
      toast.success('Z report saved')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const detailStatus =
    report.error && axios.isAxiosError(report.error)
      ? report.error.response?.status
      : undefined
  const record = report.data

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
                to='/o/$organizationSlug/pos-devices/$deviceId/z-reports'
                params={{ organizationSlug, deviceId: deviceUuid }}
                className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                All Z reports
              </Link>
            )}
          </div>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !report.isError ? record.reportNumber : 'Z report'}
          </h1>
        </div>

        {(deviceUuid === null || reportUuid === null) && (
          <p role='alert'>Z report not found.</p>
        )}
        {deviceUuid !== null && reportUuid !== null && report.isPending && (
          <p role='status'>Loading Z report…</p>
        )}
        {deviceUuid !== null &&
          reportUuid !== null &&
          report.isError &&
          detailStatus === 404 && <p role='alert'>Z report not found.</p>}
        {deviceUuid !== null &&
          reportUuid !== null &&
          report.isError &&
          detailStatus !== 404 && (
            <p role='alert'>
              {errorMessage(report.error)}{' '}
              <Button variant='outline' onClick={() => void report.refetch()}>
                Retry
              </Button>
            </p>
          )}

        {record && !report.isError && (
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <h2 className='text-xl font-semibold'>Report</h2>
              <Button
                type='button'
                onClick={() => {
                  update.reset()
                  setEditing(record)
                }}
              >
                Edit report
              </Button>
            </div>
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>Report number</dt>
              <dd>{record.reportNumber}</dd>
              <dt>Device</dt>
              <dd>
                <Link
                  to='/o/$organizationSlug/pos-devices/$deviceId'
                  params={{
                    organizationSlug,
                    deviceId: record.posDevice.uuid,
                  }}
                  className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                >
                  {record.posDevice.name}
                </Link>
              </dd>
              <dt>Business date</dt>
              <dd>{record.businessDate}</dd>
              <dt>Closed</dt>
              <dd>{new Date(record.closedAt).toLocaleString()}</dd>
              <dt>Total</dt>
              <dd>
                {record.totalAmount} {record.currencyCode}
              </dd>
              <dt>Note</dt>
              <dd>{record.note || '—'}</dd>
              <dt>Sales batch</dt>
              <dd>
                {record.salesBatch ? (
                  <Link
                    to='/o/$organizationSlug/sales/batches/$batchId'
                    params={{
                      organizationSlug,
                      batchId: record.salesBatch.uuid,
                    }}
                    className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {record.salesBatch.reference || record.salesBatch.uuid}
                  </Link>
                ) : (
                  'Not linked to a sales batch'
                )}
              </dd>
              <dt>Version</dt>
              <dd>{record.version}</dd>
              <dt>Created</dt>
              <dd>{new Date(record.createdAt).toLocaleString()}</dd>
              <dt>Last updated</dt>
              <dd>{new Date(record.updatedAt).toLocaleString()}</dd>
            </dl>
            <p className='text-sm text-muted-foreground'>
              A Z report is reconciliation evidence. Linking a sales batch does
              not settle, collect or move money, and one batch may be covered by
              several reports or only partially.
            </p>
          </section>
        )}
      </Main>
      {editing &&
        editing.uuid === reportUuid &&
        editing.posDevice.uuid === deviceUuid && (
          <ReportForm
            report={editing}
            pending={update.isPending}
            error={update.error}
            onClose={() => setEditing(null)}
            onSubmit={(body) =>
              update.mutate({
                body,
                version: editing.version,
                target: {
                  deviceUuid: editing.posDevice.uuid,
                  reportUuid: editing.uuid,
                },
                scope,
              })
            }
          />
        )}
    </>
  )
}
