import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { branchCacheScope } from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationLocation } from '@/lib/organization-navigation'
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
 * list of the batch's own branch. It is evidence only: several reports may
 * cover a batch, coverage may be partial, and nothing here settles, collects or
 * moves money.
 */
export function BatchZReports({
  batchUuid,
  branchUuid,
}: {
  batchUuid: string
  branchUuid: string
}) {
  const organizationSlug = useOrganizationSlug()
  const scope = branchCacheScope(branchUuid)
  const [page, setPage] = useState(0)
  const reports = useQuery({
    queryKey: [
      'pos-devices',
      scope,
      branchUuid,
      'reports',
      'by-batch',
      batchUuid,
      page,
    ],
    queryFn: () =>
      zReportsApi.list({
        branchUuid,
        page,
        salesBatchUuid: batchUuid,
        limit: 10,
      }),
  })
  const data = reports.data
  return (
    <section className='space-y-2'>
      <h2 className='text-xl font-semibold'>
        {t('operations:zReports.batchReports.title')}
      </h2>
      <p className='text-sm text-muted-foreground'>
        {t('operations:zReports.batchReports.description')}
      </p>
      {reports.isPending && (
        <p role='status'>{t('operations:zReports.batchReports.loading')}</p>
      )}
      {reports.isError && (
        <p role='alert'>
          {errorMessage(reports.error)}{' '}
          <Button variant='outline' onClick={() => void reports.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {data &&
        (data.items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            {data.total > 0
              ? t('operations:zReports.batchReports.emptyPage')
              : t('operations:zReports.batchReports.empty')}
          </p>
        ) : (
          <Table>
            <caption className='sr-only'>
              {t('operations:zReports.batchReports.caption')}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('operations:zReports.batchReports.columns.report')}
                </TableHead>
                <TableHead>
                  {t('operations:zReports.batchReports.columns.device')}
                </TableHead>
                <TableHead>
                  {t('operations:zReports.batchReports.columns.businessDate')}
                </TableHead>
                <TableHead>
                  {t('operations:zReports.batchReports.columns.closed')}
                </TableHead>
                <TableHead>
                  {t('operations:zReports.batchReports.columns.total')}
                </TableHead>
                <TableHead>
                  {t('operations:zReports.batchReports.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((report) => (
                <TableRow key={report.uuid}>
                  <TableCell>{report.reportNumber}</TableCell>
                  <TableCell>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        report.branch.uuid,
                        '/pos-devices/$deviceId',
                        { deviceId: report.posDevice.uuid }
                      )}
                      aria-label={t(
                        'operations:zReports.batchReports.deviceLabel',
                        { name: report.posDevice.name }
                      )}
                      className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {report.posDevice.name}
                    </Link>
                  </TableCell>
                  <TableCell>{report.businessDate}</TableCell>
                  <TableCell>
                    {new Date(report.closedAt).toLocaleString(locale)}
                  </TableCell>
                  <TableCell>
                    {report.totalAmount} {report.currencyCode}
                  </TableCell>
                  <TableCell>
                    <Link
                      {...organizationLocation(
                        organizationSlug,
                        report.branch.uuid,
                        '/pos-devices/$deviceId/z-reports/$reportId',
                        {
                          deviceId: report.posDevice.uuid,
                          reportId: report.uuid,
                        }
                      )}
                      aria-label={t(
                        'operations:zReports.batchReports.detailsLabel',
                        { report: report.reportNumber }
                      )}
                      className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                    >
                      {t('operations:zReports.batchReports.details')}
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
