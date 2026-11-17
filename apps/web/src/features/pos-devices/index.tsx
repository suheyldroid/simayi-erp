import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch, type BranchContext } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
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
import { errorMessage, posDevicesApi } from './api'
import { DeviceForm } from './components/device-form'
import type { PosDevice, PosDeviceInput } from './model'

function deviceColumns(
  organizationSlug: string,
  companyMode: boolean
): SortableColumn<PosDevice>[] {
  return [
    {
      id: 'name',
      header: t('operations:posDevices.list.columns.name'),
      accessorFn: (device) => device.name,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    ...(companyMode
      ? [
          {
            id: 'branch',
            header: t('operations:posDevices.list.columns.branch'),
            accessorFn: (device: PosDevice) => device.branch.name,
            cell: ({ row }: { row: { original: PosDevice } }) =>
              row.original.branch.name,
          } satisfies SortableColumn<PosDevice>,
        ]
      : []),
    {
      id: 'bank',
      header: t('operations:posDevices.list.columns.bank'),
      accessorFn: (device) => device.bankName,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'terminal',
      header: t('operations:posDevices.list.columns.terminalId'),
      accessorFn: (device) => device.terminalId,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'state',
      header: t('operations:posDevices.list.columns.state'),
      accessorFn: (device) =>
        device.active
          ? t('operations:posDevices.state.active')
          : t('operations:posDevices.state.inactive'),
      cell: ({ row }) =>
        row.original.active
          ? t('operations:posDevices.state.active')
          : t('operations:posDevices.state.inactive'),
    },
    {
      id: 'updated',
      header: t('operations:posDevices.list.columns.updated'),
      accessorFn: (device) => new Date(device.updatedAt).getTime(),
      cell: ({ row }) =>
        new Date(row.original.updatedAt).toLocaleString(locale),
    },
    {
      id: 'actions',
      header: t('operations:posDevices.list.columns.actions'),
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          {...organizationLocation(
            organizationSlug,
            row.original.branch.uuid,
            '/pos-devices/$deviceId',
            { deviceId: row.original.uuid }
          )}
          aria-label={t('operations:posDevices.list.detailsLabel', {
            name: row.original.name,
          })}
          className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          {t('operations:posDevices.list.details')}
        </Link>
      ),
    },
  ]
}

/**
 * Company context lists every branch's devices; a branch path lists exactly
 * its own. Devices are branch-owned, so creating one stays a branch-only
 * operation and every row link opens the owning branch path.
 */
export function PosDevicesPage() {
  const branch = useOptionalBranch()
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>
            {t('operations:posDevices.index.title')}
          </h1>
          <p className='text-muted-foreground'>
            {branch === null
              ? t('operations:posDevices.index.companyDescription')
              : t('operations:posDevices.index.description')}
          </p>
        </div>
        <PosDeviceDirectory branch={branch} />
      </Main>
    </>
  )
}

function PosDeviceDirectory({ branch }: { branch: BranchContext | null }) {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const branchUuid = branch?.branchUuid ?? null
  const companyMode = branchUuid === null
  const scope = branchCacheScope(branchUuid)
  const branchActive = branch?.branch.active ?? false
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const columns = useMemo(
    () => deviceColumns(organizationSlug, companyMode),
    [organizationSlug, companyMode]
  )
  const devices = useQuery({
    queryKey: ['pos-devices', scope, branchUuid, 'list', page, search],
    queryFn: () => posDevicesApi.list({ branchUuid, page, search }),
  })
  const create = useMutation({
    mutationFn: (input: {
      body: PosDeviceInput
      captured: CapturedBranchScope
    }) => {
      if (input.captured.branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return posDevicesApi.create(input.captured.branchUuid, input.body)
    },
    onSuccess: async (_device, input) => {
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
      toast.success(t('operations:posDevices.list.created'))
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const data = devices.data
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        {branch !== null && (
          <p className='text-sm text-muted-foreground'>
            {t('operations:posDevices.list.branch')}{' '}
            <span className='font-medium'>{branch.branch.name}</span>
          </p>
        )}
        <Button
          type='button'
          disabled={!branchActive}
          title={
            companyMode
              ? t('operations:posDevices.list.selectBranchForCreate')
              : undefined
          }
          onClick={() => {
            create.reset()
            setCreating(true)
          }}
        >
          {t('operations:posDevices.list.create')}
        </Button>
      </div>
      {branch !== null && !branch.branch.active && (
        <BranchInactiveNotice branchName={branch.branch.name} />
      )}
      <form
        className='flex flex-wrap gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSearch(draft)
        }}
      >
        <Input
          aria-label={t('operations:posDevices.list.searchLabel')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('operations:posDevices.list.searchPlaceholder')}
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>{t('operations:common.find')}</Button>
      </form>
      {devices.isPending && (
        <p role='status'>{t('operations:posDevices.list.loading')}</p>
      )}
      {devices.isError && (
        <p role='alert'>
          {errorMessage(devices.error)}{' '}
          <Button variant='outline' onClick={() => void devices.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('operations:posDevices.list.total', {
              count: data.total.toLocaleString(locale),
            })}
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(device) => device.uuid}
            caption={
              companyMode
                ? t('operations:posDevices.list.captionCompany')
                : t('operations:posDevices.list.caption', {
                    branch: branch?.branch.name ?? '',
                  })
            }
            emptyMessage={
              search
                ? t('operations:posDevices.list.emptySearch')
                : data.total > 0
                  ? t('operations:posDevices.list.emptyPage')
                  : companyMode
                    ? t('operations:posDevices.list.emptyCompany')
                    : t('operations:posDevices.list.empty')
            }
          />
        </>
      )}
      <PageControls
        page={page}
        loading={devices.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {creating && branch !== null && branchActive && (
        <DeviceForm
          key={branchUuid}
          device='new'
          branchName={branch.branch.name}
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={(body) =>
            create.mutate({ body, captured: captureBranchScope(branchUuid) })
          }
        />
      )}
    </div>
  )
}
