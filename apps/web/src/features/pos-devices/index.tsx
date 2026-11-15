import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
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
import { errorMessage, posDevicesApi } from './api'
import { DeviceForm } from './components/device-form'
import type { PosDevice, PosDeviceInput } from './model'

function deviceColumns(organizationSlug: string): SortableColumn<PosDevice>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      accessorFn: (device) => device.name,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'bank',
      header: 'Bank',
      accessorFn: (device) => device.bankName,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'terminal',
      header: 'Terminal ID',
      accessorFn: (device) => device.terminalId,
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'state',
      header: 'State',
      accessorFn: (device) => (device.active ? 'Active' : 'Inactive'),
      cell: ({ getValue }) => String(getValue() ?? ''),
    },
    {
      id: 'updated',
      header: 'Updated',
      accessorFn: (device) => new Date(device.updatedAt).getTime(),
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to='/o/$organizationSlug/pos-devices/$deviceId'
          params={{
            organizationSlug,
            deviceId: row.original.uuid,
          }}
          aria-label={`Details for POS device ${row.original.name}`}
          className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Details
        </Link>
      ),
    },
  ]
}

export function PosDevicesPage() {
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Bank POS devices</h1>
          <p className='text-muted-foreground'>
            Bank POS terminals, not fiscal cash registers. Each device keeps its
            own Z reports as reconciliation evidence; a report never creates a
            sale and writes no finance entry. Devices are deactivated, never
            deleted.
          </p>
        </div>
        <PosDeviceDirectory />
      </Main>
    </>
  )
}

function PosDeviceDirectory() {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const columns = useMemo(
    () => deviceColumns(organizationSlug),
    [organizationSlug]
  )
  const devices = useQuery({
    queryKey: ['pos-devices', scope, 'list', page, search],
    queryFn: () => posDevicesApi.list({ page, search }),
  })
  const create = useMutation({
    mutationFn: (input: { body: PosDeviceInput; scope: string }) =>
      posDevicesApi.create(input.body),
    onSuccess: async (_device, input) => {
      setCreating(false)
      await client.invalidateQueries({
        queryKey: ['pos-devices', input.scope],
      })
      toast.success('Bank POS device created')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const data = devices.data
  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button
          type='button'
          onClick={() => {
            create.reset()
            setCreating(true)
          }}
        >
          New device
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
          aria-label='Search bank POS devices'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder='Search devices'
          maxLength={100}
          className='max-w-sm'
        />
        <Button variant='outline'>Find</Button>
      </form>
      {devices.isPending && <p role='status'>Loading bank POS devices…</p>}
      {devices.isError && (
        <p role='alert'>
          {errorMessage(devices.error)}{' '}
          <Button variant='outline' onClick={() => void devices.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {data.total} bank POS devices. Sorting applies to this page only.
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(device) => device.uuid}
            caption='Bank POS devices'
            emptyMessage={
              search
                ? 'No bank POS devices match this search.'
                : data.total > 0
                  ? 'No bank POS devices on this page.'
                  : 'No bank POS devices have been added yet.'
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
      {creating && (
        <DeviceForm
          device='new'
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={(body) => create.mutate({ body, scope })}
        />
      )}
    </div>
  )
}
