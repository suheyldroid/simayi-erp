import { useMemo, useState } from 'react'
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
import { errorMessage, posDevicesApi, zReportsApi } from '../api'
import { ReportForm } from '../components/report-form'
import type { ZReport, ZReportInput } from '../model'

function reportColumns(organizationSlug: string): SortableColumn<ZReport>[] {
  return [
    {
      id: 'number',
      header: t('operations:zReports.list.columns.report'),
      accessorFn: (report) => report.reportNumber,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'businessDate',
      header: t('operations:zReports.list.columns.businessDate'),
      accessorFn: (report) => report.businessDate,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'closedAt',
      header: t('operations:zReports.list.columns.closed'),
      accessorFn: (report) => new Date(report.closedAt).getTime(),
      cell: ({ row }) => new Date(row.original.closedAt).toLocaleString(locale),
    },
    {
      id: 'amount',
      header: t('operations:zReports.list.columns.total'),
      // Exact decimal strings are not compared as numbers here.
      enableSorting: false,
      accessorFn: (report) => report.totalAmount,
      cell: ({ row }) =>
        `${row.original.totalAmount} ${row.original.currencyCode}`,
    },
    {
      id: 'batch',
      header: t('operations:zReports.list.columns.batch'),
      accessorFn: (report) =>
        report.salesBatch?.reference || report.salesBatch?.uuid || '',
      cell: ({ getValue }) => String(getValue() ?? '') || '—',
    },
    {
      id: 'actions',
      header: t('operations:zReports.list.columns.actions'),
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          {...organizationLocation(
            organizationSlug,
            row.original.branch.uuid,
            '/pos-devices/$deviceId/z-reports/$reportId',
            {
              deviceId: row.original.posDevice.uuid,
              reportId: row.original.uuid,
            }
          )}
          aria-label={t('operations:zReports.list.detailsLabel', {
            report: row.original.reportNumber,
          })}
          className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          {t('operations:zReports.list.details')}
        </Link>
      ),
    },
  ]
}

export function ZReportsPage() {
  const branch = useOptionalBranch()
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <ZReportsBody branchUuid={branch?.branchUuid ?? null} />
      </Main>
    </>
  )
}

function ZReportsBody({ branchUuid }: { branchUuid: string | null }) {
  const { deviceId } = useOrganizationResourceParams()
  const branch = useOptionalBranch()
  const branchActive = branch?.branch.active ?? false
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = branchCacheScope(branchUuid)
  const deviceUuid = deviceId === undefined ? null : parseResourceUuid(deviceId)
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const columns = useMemo(
    () => reportColumns(organizationSlug),
    [organizationSlug]
  )
  const device = useQuery({
    queryKey: ['pos-devices', scope, branchUuid, 'detail', deviceUuid],
    queryFn: () => {
      if (deviceUuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return posDevicesApi.get(branchUuid, deviceUuid)
    },
    enabled: deviceUuid !== null,
  })
  const reports = useQuery({
    queryKey: [
      'pos-devices',
      scope,
      branchUuid,
      'reports',
      'list',
      deviceUuid,
      page,
      search,
    ],
    queryFn: () => {
      if (deviceUuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return zReportsApi.list({
        branchUuid,
        page,
        search,
        posDeviceUuid: deviceUuid,
      })
    },
    enabled: deviceUuid !== null,
  })
  const create = useMutation({
    mutationFn: (input: {
      body: ZReportInput
      deviceUuid: string
      captured: CapturedBranchScope
    }) => {
      if (input.captured.branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return zReportsApi.create(
        input.captured.branchUuid,
        input.deviceUuid,
        input.body
      )
    },
    onSuccess: async (_report, input) => {
      setCreating(false)
      const companyScope = `${input.captured.organizationScope}::company`
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['pos-devices', input.captured.scope],
        }),
        client.invalidateQueries({
          queryKey: ['pos-devices', companyScope],
        }),
      ])
      toast.success(t('operations:zReports.list.created'))
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
            {t('operations:zReports.list.back')}
          </Link>
          {deviceUuid !== null && (
            <Link
              {...organizationLocation(
                organizationSlug,
                record?.branch.uuid ?? branchUuid,
                '/pos-devices/$deviceId',
                { deviceId: deviceUuid }
              )}
              className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              {t('operations:zReports.list.device')}
            </Link>
          )}
        </div>
        <h1 className='mt-2 text-2xl font-bold'>
          {record && !device.isError
            ? t('operations:zReports.list.titleWithDevice', {
                device: record.name,
              })
            : t('operations:zReports.list.title')}
        </h1>
        <p className='text-muted-foreground'>
          {t('operations:zReports.list.description')}
        </p>
      </div>

      {!branchActive && <BranchInactiveNotice />}

      {deviceUuid === null && (
        <p role='alert'>{t('operations:zReports.list.deviceNotFound')}</p>
      )}
      {deviceUuid !== null && device.isPending && (
        <p role='status'>{t('operations:zReports.list.loadingDevice')}</p>
      )}
      {deviceUuid !== null && device.isError && detailStatus === 404 && (
        <p role='alert'>{t('operations:zReports.list.deviceNotFound')}</p>
      )}
      {deviceUuid !== null && device.isError && detailStatus !== 404 && (
        <p role='alert'>
          {errorMessage(device.error)}{' '}
          <Button variant='outline' onClick={() => void device.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}

      {record && !device.isError && (
        <div className='space-y-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm text-muted-foreground'>
              {t('operations:zReports.list.branch')}{' '}
              <span className='font-medium'>{record.branch.name}</span>
            </p>
            {branchActive ? (
              <Button
                type='button'
                onClick={() => {
                  create.reset()
                  setCreating(true)
                }}
              >
                {t('operations:zReports.list.create')}
              </Button>
            ) : null}
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
              aria-label={t('operations:zReports.list.searchLabel')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('operations:zReports.list.searchPlaceholder')}
              maxLength={100}
              className='max-w-sm'
            />
            <Button variant='outline'>{t('operations:common.find')}</Button>
          </form>
          {reports.isPending && (
            <p role='status'>{t('operations:zReports.list.loading')}</p>
          )}
          {reports.isError && (
            <p role='alert'>
              {errorMessage(reports.error)}{' '}
              <Button variant='outline' onClick={() => void reports.refetch()}>
                {t('operations:common.retry')}
              </Button>
            </p>
          )}
          {data && (
            <>
              <p className='text-sm text-muted-foreground'>
                {t('operations:zReports.list.total', { count: data.total })}
              </p>
              <SortableDataTable
                data={data.items}
                columns={columns}
                getRowId={(report) => report.uuid}
                caption={t('operations:zReports.list.caption', {
                  device: record.name,
                })}
                emptyMessage={
                  search
                    ? t('operations:zReports.list.emptySearch')
                    : data.total > 0
                      ? t('operations:zReports.list.emptyPage')
                      : t('operations:zReports.list.empty')
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
      {creating &&
        branchActive &&
        deviceUuid !== null &&
        record !== undefined && (
          <ReportForm
            key={`${record.branch.uuid}:${deviceUuid}`}
            report='new'
            branchUuid={record.branch.uuid}
            branchName={record.branch.name}
            pending={create.isPending}
            error={create.error}
            onClose={() => setCreating(false)}
            onSubmit={(body) =>
              create.mutate({
                body,
                deviceUuid,
                captured: captureBranchScope(record.branch.uuid),
              })
            }
          />
        )}
    </>
  )
}
