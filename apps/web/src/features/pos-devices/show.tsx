import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button, buttonVariants } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, posDevicesApi } from './api'
import { DeviceForm } from './components/device-form'
import type { PosDevice, PosDeviceInput } from './model'

const deviceRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/$deviceId'
)

export function PosDeviceDetail() {
  const { deviceId } = deviceRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const uuid = parseResourceUuid(deviceId)
  const [editing, setEditing] = useState<PosDevice | null>(null)
  const device = useQuery({
    queryKey: ['pos-devices', scope, 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('POS device uuid is required')
      return posDevicesApi.get(uuid)
    },
    enabled: uuid !== null,
  })
  const update = useMutation({
    mutationFn: (input: {
      body: PosDeviceInput
      version: number
      targetUuid: string
      scope: string
    }) =>
      posDevicesApi.update(input.targetUuid, {
        ...input.body,
        version: input.version,
      }),
    onSuccess: async (_device, input) => {
      setEditing(null)
      // Reports show the device name, so the whole resource scope is stale.
      await client.invalidateQueries({
        queryKey: ['pos-devices', input.scope],
      })
      toast.success('Bank POS device saved')
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
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div className='space-y-1'>
          <Link
            to='/o/$organizationSlug/pos-devices'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to bank POS devices
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !device.isError ? record.name : 'Bank POS device'}
          </h1>
        </div>

        {uuid === null && <p role='alert'>Bank POS device not found.</p>}
        {uuid !== null && device.isPending && (
          <p role='status'>Loading bank POS device…</p>
        )}
        {uuid !== null && device.isError && detailStatus === 404 && (
          <p role='alert'>Bank POS device not found.</p>
        )}
        {uuid !== null && device.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(device.error)}{' '}
            <Button variant='outline' onClick={() => void device.refetch()}>
              Retry
            </Button>
          </p>
        )}

        {record && !device.isError && (
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <h2 className='text-xl font-semibold'>Device</h2>
              <div className='flex flex-wrap gap-2'>
                <Link
                  to='/o/$organizationSlug/pos-devices/$deviceId/z-reports'
                  params={{
                    organizationSlug,
                    deviceId: record.uuid,
                  }}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Z reports
                </Link>
                <Button
                  type='button'
                  onClick={() => {
                    update.reset()
                    setEditing(record)
                  }}
                >
                  Edit device
                </Button>
              </div>
            </div>
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>Name</dt>
              <dd>{record.name}</dd>
              <dt>Bank</dt>
              <dd>{record.bankName}</dd>
              <dt>Terminal ID</dt>
              <dd>{record.terminalId}</dd>
              <dt>State</dt>
              <dd>{record.active ? 'Active' : 'Inactive'}</dd>
              <dt>Version</dt>
              <dd>{record.version}</dd>
              <dt>Created</dt>
              <dd>{new Date(record.createdAt).toLocaleString()}</dd>
              <dt>Last updated</dt>
              <dd>{new Date(record.updatedAt).toLocaleString()}</dd>
            </dl>
            <p className='text-sm text-muted-foreground'>
              A device is retired by clearing Active in the edit sheet; there is
              no delete. Its Z reports stay available as reconciliation
              evidence.
            </p>
          </section>
        )}
      </Main>
      {editing && editing.uuid === uuid && (
        <DeviceForm
          device={editing}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={(body) =>
            update.mutate({
              body,
              version: editing.version,
              targetUuid: editing.uuid,
              scope,
            })
          }
        />
      )}
    </>
  )
}
