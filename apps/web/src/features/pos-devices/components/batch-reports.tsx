import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
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
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, zReportsApi } from '../api'

/**
 * Z reports linked to one sales batch, read from the real paginated report
 * list. It is evidence only: several reports may cover a batch, coverage may be
 * partial, and nothing here settles, collects or moves money.
 */
export function BatchZReports({ batchUuid }: { batchUuid: string }) {
  const organizationSlug = useOrganizationSlug()
  const scope = organizationCacheScope()
  const [page, setPage] = useState(0)
  const reports = useQuery({
    queryKey: ['pos-devices', scope, 'reports', 'by-batch', batchUuid, page],
    queryFn: () =>
      zReportsApi.list({ page, salesBatchUuid: batchUuid, limit: 10 }),
  })
  const data = reports.data
  return (
    <section className='space-y-2'>
      <h2 className='text-xl font-semibold'>Linked POS Z reports</h2>
      <p className='text-sm text-muted-foreground'>
        A batch can have several bank POS Z reports or none. A report may cover
        only part of this batch. Linking is reconciliation evidence: it never
        settles, collects or moves money.
      </p>
      {reports.isPending && <p role='status'>Loading linked Z reports…</p>}
      {reports.isError && (
        <p role='alert'>
          {errorMessage(reports.error)}{' '}
          <Button variant='outline' onClick={() => void reports.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data &&
        (data.items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            {data.total > 0
              ? 'No linked Z reports on this page.'
              : 'No bank POS Z report is linked to this batch.'}
          </p>
        ) : (
          <Table>
            <caption className='sr-only'>
              Bank POS Z reports linked to this sales batch
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Business date</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((report) => (
                <TableRow key={report.uuid}>
                  <TableCell>{report.reportNumber}</TableCell>
                  <TableCell>
                    <Link
                      to='/o/$organizationSlug/pos-devices/$deviceId'
                      params={{
                        organizationSlug,
                        deviceId: report.posDevice.uuid,
                      }}
                      aria-label={`Details for POS device ${report.posDevice.name}`}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {report.posDevice.name}
                    </Link>
                  </TableCell>
                  <TableCell>{report.businessDate}</TableCell>
                  <TableCell>
                    {new Date(report.closedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {report.totalAmount} {report.currencyCode}
                  </TableCell>
                  <TableCell>
                    <Link
                      to='/o/$organizationSlug/pos-devices/$deviceId/z-reports/$reportId'
                      params={{
                        organizationSlug,
                        deviceId: report.posDevice.uuid,
                        reportId: report.uuid,
                      }}
                      aria-label={`Details for Z report ${report.reportNumber}`}
                      className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      Details
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
      {data && data.total > 0 && (
        <PageControls
          page={page}
          loading={reports.isFetching}
          hasNext={(page + 1) * data.limit < data.total}
          onChange={setPage}
        />
      )}
    </section>
  )
}
