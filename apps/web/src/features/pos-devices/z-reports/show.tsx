import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import {
  organizationLocation,
  useOrganizationResourceParams,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { Button } from '@/components/ui/button'
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, zReportsApi } from '../api'
import { ReportForm } from '../components/report-form'
import type { ZReport, ZReportInput } from '../model'

export function ZReportDetail() {
  const branch = useOptionalBranch()
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <ReportDetailBody branchUuid={branch?.branchUuid ?? null} />
      </Main>
    </>
  )
}

function ReportDetailBody({ branchUuid }: { branchUuid: string | null }) {
  const { deviceId, reportId } = useOrganizationResourceParams()
  const branchActive = useOptionalBranch()?.branch.active ?? false
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = branchCacheScope(branchUuid)
  const deviceUuid = deviceId === undefined ? null : parseResourceUuid(deviceId)
  const reportUuid = reportId === undefined ? null : parseResourceUuid(reportId)
  const [editing, setEditing] = useState<ZReport | null>(null)
  const report = useQuery({
    queryKey: [
      'pos-devices',
      scope,
      branchUuid,
      'reports',
      'detail',
      deviceUuid,
      reportUuid,
    ],
    queryFn: () => {
      if (deviceUuid === null || reportUuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return zReportsApi.get(branchUuid, deviceUuid, reportUuid)
    },
    enabled: deviceUuid !== null && reportUuid !== null,
  })
  const update = useMutation({
    mutationFn: (input: {
      body: ZReportInput
      version: number
      target: { deviceUuid: string; reportUuid: string }
      captured: CapturedBranchScope
    }) => {
      if (input.captured.branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return zReportsApi.update(
        input.captured.branchUuid,
        input.target.deviceUuid,
        input.target.reportUuid,
        {
          ...input.body,
          version: input.version,
        }
      )
    },
    onSuccess: async (_report, input) => {
      setEditing(null)
      // Attaching or detaching a batch also changes the batch's report list;
      // the company aggregate list of the same organization is stale too.
      const companyScope = `${input.captured.organizationScope}::company`
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['pos-devices', input.captured.scope],
        }),
        client.invalidateQueries({
          queryKey: ['pos-devices', companyScope],
        }),
      ])
      toast.success(t('operations:zReports.detail.saved'))
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
      <div className='space-y-1'>
        <div className='flex flex-wrap gap-4'>
          <Link
            {...organizationLocation(
              organizationSlug,
              branchUuid,
              '/pos-devices'
            )}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('operations:zReports.detail.back')}
          </Link>
          {deviceUuid !== null && (
            <Link
              {...organizationLocation(
                organizationSlug,
                record?.branch.uuid ?? branchUuid,
                '/pos-devices/$deviceId/z-reports',
                { deviceId: deviceUuid }
              )}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              {t('operations:zReports.detail.allReports')}
            </Link>
          )}
        </div>
        <h1 className='mt-2 text-2xl font-bold'>
          {record && !report.isError
            ? record.reportNumber
            : t('operations:zReports.detail.title')}
        </h1>
      </div>

      {!branchActive && <BranchInactiveNotice />}

      {(deviceUuid === null || reportUuid === null) && (
        <p role='alert'>{t('operations:zReports.detail.notFound')}</p>
      )}
      {deviceUuid !== null && reportUuid !== null && report.isPending && (
        <p role='status'>{t('operations:zReports.detail.loading')}</p>
      )}
      {deviceUuid !== null &&
        reportUuid !== null &&
        report.isError &&
        detailStatus === 404 && (
          <p role='alert'>{t('operations:zReports.detail.notFound')}</p>
        )}
      {deviceUuid !== null &&
        reportUuid !== null &&
        report.isError &&
        detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(report.error)}{' '}
            <Button variant='outline' onClick={() => void report.refetch()}>
              {t('operations:common.retry')}
            </Button>
          </p>
        )}

      {record && !report.isError && (
        <section className='space-y-4 rounded-md border border-border p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <h2 className='text-xl font-semibold'>
              {t('operations:zReports.detail.sectionTitle')}
            </h2>
            {branchActive ? (
              <Button
                type='button'
                onClick={() => {
                  update.reset()
                  setEditing(record)
                }}
              >
                {t('operations:zReports.detail.edit')}
              </Button>
            ) : null}
          </div>
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>{t('operations:zReports.detail.fields.reportNumber')}</dt>
            <dd>{record.reportNumber}</dd>
            <dt>{t('operations:zReports.detail.fields.device')}</dt>
            <dd>
              <Link
                {...organizationLocation(
                  organizationSlug,
                  record.branch.uuid,
                  '/pos-devices/$deviceId',
                  { deviceId: record.posDevice.uuid }
                )}
                className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                {record.posDevice.name}
              </Link>
            </dd>
            <dt>{t('operations:zReports.detail.fields.branch')}</dt>
            <dd>{record.branch.name}</dd>
            <dt>{t('operations:zReports.detail.fields.businessDate')}</dt>
            <dd>{record.businessDate}</dd>
            <dt>{t('operations:zReports.detail.fields.closed')}</dt>
            <dd>{new Date(record.closedAt).toLocaleString(locale)}</dd>
            <dt>{t('operations:zReports.detail.fields.total')}</dt>
            <dd>
              {record.totalAmount} {record.currencyCode}
            </dd>
            <dt>{t('operations:zReports.detail.fields.note')}</dt>
            <dd>{record.note || '—'}</dd>
            <dt>{t('operations:zReports.detail.fields.batch')}</dt>
            <dd>
              {record.salesBatch ? (
                <Link
                  {...organizationLocation(
                    organizationSlug,
                    record.branch.uuid,
                    '/sales/batches/$batchId',
                    { batchId: record.salesBatch.uuid }
                  )}
                  className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                >
                  {record.salesBatch.reference || record.salesBatch.uuid}
                </Link>
              ) : (
                t('operations:zReports.detail.noBatch')
              )}
            </dd>
            <dt>{t('operations:zReports.detail.fields.version')}</dt>
            <dd>{record.version}</dd>
            <dt>{t('operations:zReports.detail.fields.created')}</dt>
            <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
            <dt>{t('operations:zReports.detail.fields.updated')}</dt>
            <dd>{new Date(record.updatedAt).toLocaleString(locale)}</dd>
          </dl>
          <p className='text-sm text-muted-foreground'>
            {t('operations:zReports.detail.hint')}
          </p>
        </section>
      )}
      {editing &&
        branchActive &&
        editing.uuid === reportUuid &&
        editing.posDevice.uuid === deviceUuid && (
          <ReportForm
            key={`${editing.branch.uuid}:${editing.uuid}`}
            report={editing}
            branchUuid={editing.branch.uuid}
            branchName={editing.branch.name}
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
                captured: captureBranchScope(editing.branch.uuid),
              })
            }
          />
        )}
    </>
  )
}
