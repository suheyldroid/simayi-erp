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
import { Button, buttonVariants } from '@/components/ui/button'
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, posDevicesApi } from './api'
import { DeviceForm } from './components/device-form'
import type { PosDevice, PosDeviceInput } from './model'

export function PosDeviceDetail() {
  const branch = useOptionalBranch()
  const branchUuid = branch?.branchUuid ?? null
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <DeviceDetailBody branchUuid={branchUuid} />
      </Main>
    </>
  )
}

function DeviceDetailBody({ branchUuid }: { branchUuid: string | null }) {
  const { deviceId } = useOrganizationResourceParams()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = branchCacheScope(branchUuid)
  const uuid = deviceId === undefined ? null : parseResourceUuid(deviceId)
  const branchActive = useOptionalBranch()?.branch.active ?? false
  const [editing, setEditing] = useState<PosDevice | null>(null)
  const device = useQuery({
    queryKey: ['pos-devices', scope, branchUuid, 'detail', uuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('operations:common.errors.uuidRequired'))
      return posDevicesApi.get(branchUuid, uuid)
    },
    enabled: uuid !== null,
  })
  const update = useMutation({
    mutationFn: (input: {
      body: PosDeviceInput
      version: number
      targetUuid: string
      captured: CapturedBranchScope
    }) => {
      if (input.captured.branchUuid === null)
        throw new Error(t('operations:common.errors.branchRequired'))
      return posDevicesApi.update(input.captured.branchUuid, input.targetUuid, {
        ...input.body,
        version: input.version,
      })
    },
    onSuccess: async (_device, input) => {
      setEditing(null)
      // Reports show the device name, so the whole resource scope is stale;
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
      toast.success(t('operations:posDevices.detail.saved'))
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const detailStatus =
    device.error && axios.isAxiosError(device.error)
      ? device.error.response?.status
      : undefined
  const record = device.data

  return (
    <>
      <div className='space-y-1'>
        <Link
          {...organizationLocation(
            organizationSlug,
            branchUuid,
            '/pos-devices'
          )}
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          {t('operations:posDevices.detail.back')}
        </Link>
        <h1 className='mt-2 text-2xl font-bold'>
          {record && !device.isError
            ? record.name
            : t('operations:posDevices.detail.title')}
        </h1>
      </div>

      {!branchActive && <BranchInactiveNotice />}

      {uuid === null && (
        <p role='alert'>{t('operations:posDevices.detail.notFound')}</p>
      )}
      {uuid !== null && device.isPending && (
        <p role='status'>{t('operations:posDevices.detail.loading')}</p>
      )}
      {uuid !== null && device.isError && detailStatus === 404 && (
        <p role='alert'>{t('operations:posDevices.detail.notFound')}</p>
      )}
      {uuid !== null && device.isError && detailStatus !== 404 && (
        <p role='alert'>
          {errorMessage(device.error)}{' '}
          <Button variant='outline' onClick={() => void device.refetch()}>
            {t('operations:common.retry')}
          </Button>
        </p>
      )}

      {record && !device.isError && (
        <section className='space-y-4 rounded-md border border-border p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <h2 className='text-xl font-semibold'>
              {t('operations:posDevices.detail.sectionTitle')}
            </h2>
            <div className='flex flex-wrap gap-2'>
              <Link
                {...organizationLocation(
                  organizationSlug,
                  record.branch.uuid,
                  '/pos-devices/$deviceId/z-reports',
                  { deviceId: record.uuid }
                )}
                className={buttonVariants({ variant: 'outline' })}
              >
                {t('operations:posDevices.detail.zReports')}
              </Link>
              {branchActive ? (
                <Button
                  type='button'
                  onClick={() => {
                    update.reset()
                    setEditing(record)
                  }}
                >
                  {t('operations:posDevices.detail.edit')}
                </Button>
              ) : null}
            </div>
          </div>
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>{t('operations:posDevices.detail.fields.name')}</dt>
            <dd>{record.name}</dd>
            <dt>{t('operations:posDevices.detail.fields.bank')}</dt>
            <dd>{record.bankName}</dd>
            <dt>{t('operations:posDevices.detail.fields.terminalId')}</dt>
            <dd>{record.terminalId}</dd>
            <dt>{t('operations:posDevices.detail.fields.state')}</dt>
            <dd>
              {record.active
                ? t('operations:posDevices.state.active')
                : t('operations:posDevices.state.inactive')}
            </dd>
            <dt>{t('operations:posDevices.detail.fields.branch')}</dt>
            <dd>{record.branch.name}</dd>
            <dt>{t('operations:posDevices.detail.fields.version')}</dt>
            <dd>{record.version}</dd>
            <dt>{t('operations:posDevices.detail.fields.created')}</dt>
            <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
            <dt>{t('operations:posDevices.detail.fields.updated')}</dt>
            <dd>{new Date(record.updatedAt).toLocaleString(locale)}</dd>
          </dl>
          <p className='text-sm text-muted-foreground'>
            {t('operations:posDevices.detail.retirementHint')}
          </p>
        </section>
      )}
      {editing && editing.uuid === uuid && branchActive && (
        <DeviceForm
          key={`${branchUuid}:${editing.uuid}`}
          device={editing}
          branchName={editing.branch.name}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={(body) =>
            update.mutate({
              body,
              version: editing.version,
              targetUuid: editing.uuid,
              captured: captureBranchScope(branchUuid),
            })
          }
        />
      )}
    </>
  )
}
