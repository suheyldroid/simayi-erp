import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
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
        {t('catalog:common.edit')}
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
      toast.success(t('catalog:units.deletedToast'))
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
        {t('catalog:common.delete')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('catalog:units.deleteTitle')}
        desc={t('catalog:units.deleteDescription')}
        confirmText={t('catalog:common.delete')}
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
      if (uuid === null) throw new Error(t('catalog:units.uuidRequired'))
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
          {t('catalog:units.back')}
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {liveUnit
            ? `${liveUnit.name} · ${liveUnit.code}`
            : t('catalog:units.detailTitle')}
        </h2>
      </div>
      {uuid === null && <p role='alert'>{t('catalog:units.notFound')}</p>}
      {uuid !== null && details.isPending && (
        <p role='status'>{t('catalog:units.loadingOne')}</p>
      )}
      {details.isError && detailStatus === 404 && (
        <p role='alert'>{t('catalog:units.notFound')}</p>
      )}
      {details.isError && detailStatus !== 404 && (
        <p role='alert'>
          {t('catalog:units.loadError')}{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {liveUnit && (
        <section className='space-y-4 rounded-md border border-border p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h3 className='text-xl font-semibold'>
                {t('catalog:units.detailTitle')}
              </h3>
              <p className='text-sm text-muted-foreground'>
                {t('catalog:units.meta', {
                  uuid: liveUnit.uuid,
                  version: liveUnit.version,
                })}
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
            <dt>{t('catalog:units.fields.name')}</dt>
            <dd>{liveUnit.name}</dd>
            <dt>{t('catalog:units.fields.code')}</dt>
            <dd>{liveUnit.code}</dd>
            <dt>{t('catalog:units.fields.status')}</dt>
            <dd>
              {liveUnit.active
                ? t('catalog:common.active')
                : t('catalog:common.inactive')}
            </dd>
            <dt>{t('catalog:units.fields.divisible')}</dt>
            <dd>
              {liveUnit.divisible
                ? t('catalog:units.divisibleYes')
                : t('catalog:units.divisibleNo')}
            </dd>
          </dl>
          {!liveUnit.active && (
            <p className='text-sm text-muted-foreground'>
              {t('catalog:units.inactiveNote')}
            </p>
          )}
        </section>
      )}
    </section>
  )
}
