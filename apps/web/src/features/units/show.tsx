import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { errorMessage, unitApi } from './api'
import { invalidateUnitCatalog } from './cache'
import { UnitForm } from './components/unit-form'
import type { Unit } from './model'

const unitRoute = getRouteApi(
  '/_authenticated/_system/settings/system/units/$unitId'
)

function EditUnitAction({ unit }: { unit: Unit }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' variant='outline' onClick={() => setOpen(true)}>
        Edit
      </Button>
      <UnitForm
        draft={open ? { mode: 'edit', unit } : null}
        canSubmit={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function DeleteUnitAction({ unit }: { unit: Unit }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const deletion = useMutation({
    mutationFn: unitApi.removeUnit,
    onSuccess: async () => {
      await invalidateUnitCatalog(client)
      setOpen(false)
      toast.success('Unit deleted')
      await navigate({ to: '/settings/system/units' })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <>
      <Button
        type='button'
        variant='outline'
        disabled={deletion.isPending}
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title='Delete unit'
        desc='Deletion is refused while any organization still records item stock in this unit. Deactivate the unit instead to stop new selections.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => deletion.mutate(unit.uuid)}
      />
    </>
  )
}

export function UnitDetail() {
  const { unitId } = unitRoute.useParams()
  const uuid = parseResourceUuid(unitId)
  const details = useQuery({
    queryKey: ['unit', 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Unit uuid is required')
      return unitApi.unit(uuid)
    },
    enabled: uuid != null,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const unit = details.data
  const liveUnit =
    uuid !== null &&
    details.isSuccess &&
    !details.isError &&
    unit != null &&
    unit.uuid === uuid
      ? unit
      : null
  return (
    <section className='space-y-6'>
      <div>
        <Link
          to='/settings/system/units'
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Back to units
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {liveUnit ? `${liveUnit.name} · ${liveUnit.code}` : 'Unit details'}
        </h2>
      </div>
      {uuid === null && <p role='alert'>Unit not found.</p>}
      {uuid !== null && details.isPending && <p role='status'>Loading unit…</p>}
      {details.isError && detailStatus === 404 && (
        <p role='alert'>Unit not found.</p>
      )}
      {details.isError && detailStatus !== 404 && (
        <p role='alert'>
          Could not load this unit.{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {liveUnit && (
        <section className='space-y-4 rounded-md border border-border p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h3 className='text-xl font-semibold'>Unit details</h3>
              <p className='text-sm text-muted-foreground'>
                ID {liveUnit.uuid} · version {liveUnit.version}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <EditUnitAction key={`edit-${liveUnit.uuid}`} unit={liveUnit} />
              <DeleteUnitAction
                key={`delete-${liveUnit.uuid}`}
                unit={liveUnit}
              />
            </div>
          </div>
          <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt>Name</dt>
            <dd>{liveUnit.name}</dd>
            <dt>Code</dt>
            <dd>{liveUnit.code}</dd>
            <dt>Status</dt>
            <dd>{liveUnit.active ? 'Active' : 'Inactive'}</dd>
          </dl>
          {!liveUnit.active && (
            <p className='text-sm text-muted-foreground'>
              This unit is inactive. Items in any organization that already use
              it keep it, but it cannot be selected for a new item.
            </p>
          )}
        </section>
      )}
    </section>
  )
}
