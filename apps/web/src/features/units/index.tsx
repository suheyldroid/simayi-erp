import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, unitApi } from './api'
import { UnitForm } from './components/unit-form'
import type { Unit } from './model'

const PAGE_SIZE = 20

type Status = 'all' | 'active' | 'inactive'

export function Units() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Units</h2>
        <p className='text-muted-foreground'>
          System-wide measurement codes used by item stock quantities in every
          organization. Inactive units stay on existing items but cannot be
          selected for new ones.
        </p>
      </div>
      <UnitDirectory />
    </section>
  )
}

function CreateUnitAction() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' onClick={() => setOpen(true)}>
        New unit
      </Button>
      <UnitForm
        draft={open ? { mode: 'create' } : null}
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          void navigate({
            to: '/settings/system/units/$unitId',
            params: { unitId: saved.uuid },
          })
        }}
      />
    </>
  )
}

function UnitDirectory() {
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const units = useQuery({
    queryKey: ['unit', 'list', page, search, status],
    queryFn: () =>
      unitApi.units({
        page,
        search,
        limit: PAGE_SIZE,
        ...(status === 'all' ? {} : { active: status === 'active' }),
      }),
  })
  const columns = useMemo<SortableColumn<Unit>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (unit) => unit.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'code',
        header: 'Code',
        accessorFn: (unit) => unit.code,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (unit) => (unit.active ? 'Active' : 'Inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { label: 'Actions', width: 110 },
        cell: ({ row }) => (
          <Link
            to='/settings/system/units/$unitId'
            params={{ unitId: row.original.uuid }}
            aria-label={`View details for ${row.original.name} (${row.original.code})`}
            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        ),
      },
    ],
    []
  )
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <form
          className='flex flex-wrap items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label='Search units'
            placeholder='Search name or code'
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Select
            value={status}
            onValueChange={(value) => {
              if (
                value === 'all' ||
                value === 'active' ||
                value === 'inactive'
              ) {
                setStatus(value)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className='w-40' aria-label='Unit status'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Any status</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='inactive'>Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline'>Find</Button>
        </form>
        <CreateUnitAction />
      </div>
      {units.isPending && <p role='status'>Loading units…</p>}
      {units.isError && (
        <p role='alert'>
          {errorMessage(units.error)}{' '}
          <Button variant='outline' onClick={() => void units.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {units.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {units.data.total} units. Sorting applies to this page only.
          </p>
          <p className='text-sm text-muted-foreground'>
            Select Details in a row to open its unit.
          </p>
          <SortableDataTable
            data={units.data.items}
            columns={columns}
            getRowId={(unit) => unit.uuid}
            caption='Units'
            emptyMessage='No units match these filters.'
          />
        </>
      )}
      <PageControls
        page={page}
        loading={units.isFetching}
        hasNext={
          !!units.data && (page + 1) * units.data.limit < units.data.total
        }
        onChange={setPage}
      />
    </div>
  )
}
