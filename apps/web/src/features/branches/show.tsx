import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { locale, t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationResourceParams,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { branchDetailQueryOptions, branchesApi, errorMessage } from './api'
import { BranchForm } from './components/branch-form'
import type { Branch } from './model'

function isNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404
}

export function BranchDetail() {
  const {
    branchId,
    organizationSlug,
    branchUuid: selectedBranchUuid,
  } = useOrganizationResourceParams()
  const uuid = parseResourceUuid(branchId ?? '')
  const branch = useQuery({
    ...branchDetailQueryOptions(uuid ?? ''),
    enabled: uuid !== null,
  })

  if (uuid === null) return <MissingBranch />
  if (branch.isError)
    return isNotFound(branch.error) ? (
      <MissingBranch />
    ) : (
      <p role='alert'>
        {errorMessage(branch.error)}{' '}
        <Button variant='outline' onClick={() => void branch.refetch()}>
          {t('catalog:common.retry')}
        </Button>
      </p>
    )

  const record = branch.data
  if (!record) return <p role='status'>{t('catalog:branches.loadingOne')}</p>

  return (
    <section className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-bold'>{record.name}</h2>
          <p className='text-muted-foreground'>
            {t('catalog:branches.subtitle', {
              organizationSlug,
              version: record.version,
            })}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <EditBranchAction branch={record} />
          {record.active ? (
            <DeactivateBranchAction branch={record} />
          ) : (
            <ActivateBranchAction branch={record} />
          )}
        </div>
      </div>

      <dl className='grid gap-3 text-sm sm:grid-cols-2'>
        <Detail
          label={t('catalog:branches.fields.status')}
          value={
            record.active
              ? t('catalog:common.active')
              : t('catalog:common.inactive')
          }
        />
        <Detail
          label={t('catalog:branches.fields.version')}
          value={String(record.version)}
        />
        <Detail
          label={t('catalog:branches.fields.description')}
          value={record.description ?? '—'}
        />
        <Detail
          label={t('catalog:branches.fields.created')}
          value={
            record.createdAt
              ? new Date(record.createdAt).toLocaleString(locale)
              : '—'
          }
        />
        <Detail
          label={t('catalog:branches.fields.updated')}
          value={
            record.updatedAt
              ? new Date(record.updatedAt).toLocaleString(locale)
              : '—'
          }
        />
      </dl>

      {record.active ? (
        <p className='text-sm text-muted-foreground'>
          {t('catalog:branches.activeNote')}
        </p>
      ) : (
        <p className='text-sm text-muted-foreground'>
          {t('catalog:branches.inactiveNote')}
        </p>
      )}

      <p className='text-sm text-muted-foreground'>
        {selectedBranchUuid === record.uuid
          ? t('catalog:branches.currentSelection')
          : t('catalog:branches.selectHint')}{' '}
        <NavigateToBranch branch={record} />
      </p>
    </section>
  )
}

function NavigateToBranch({ branch }: { branch: Branch }) {
  const navigate = useNavigate()
  const { organizationSlug } = useOrganizationResourceParams()
  return (
    <Button
      variant='link'
      className='h-auto p-0'
      onClick={() =>
        void navigate(
          organizationLocation(
            organizationSlug,
            branch.uuid,
            '/settings/branches/$branchId',
            { branchId: branch.uuid }
          )
        )
      }
    >
      {t('catalog:branches.select')}
    </Button>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function MissingBranch() {
  return (
    <section className='space-y-2'>
      <h2 className='text-2xl font-bold'>
        {t('catalog:branches.notFoundTitle')}
      </h2>
      <p className='text-muted-foreground'>
        {t('catalog:branches.notFoundDescription')}
      </p>
    </section>
  )
}

function EditBranchAction({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' variant='outline' onClick={() => setOpen(true)}>
        {t('catalog:common.edit')}
      </Button>
      <BranchForm
        draft={open ? { mode: 'edit', branch } : null}
        canSubmit={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function useBranchLifecycleMutation() {
  const client = useQueryClient()
  const router = useRouter()
  return async (branch: Branch, active: boolean) => {
    await branchesApi.setActive(branch.uuid, {
      active,
      version: branch.version,
    })
    await client.invalidateQueries({
      queryKey: ['branch', organizationCacheScope()],
    })
    // Re-run the slug boundary so the verified route context reflects the new
    // name/active state instead of the value captured at navigation time.
    await router.invalidate()
  }
}

function DeactivateBranchAction({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false)
  const apply = useBranchLifecycleMutation()
  const mutation = useMutation({
    mutationFn: () => apply(branch, false),
    onSuccess: () => {
      toast.success(t('catalog:branches.deactivatedToast'))
      setOpen(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <>
      <Button type='button' variant='destructive' onClick={() => setOpen(true)}>
        {t('catalog:branches.deactivate')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        isLoading={mutation.isPending}
        title={t('catalog:branches.deactivateTitle', { name: branch.name })}
        desc={t('catalog:branches.deactivateDescription')}
        confirmText={t('catalog:branches.deactivateConfirm')}
        handleConfirm={() => mutation.mutate()}
      />
    </>
  )
}

function ActivateBranchAction({ branch }: { branch: Branch }) {
  const apply = useBranchLifecycleMutation()
  const mutation = useMutation({
    mutationFn: () => apply(branch, true),
    onSuccess: () => toast.success(t('catalog:branches.activatedToast')),
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Button
      type='button'
      variant='outline'
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending
        ? t('catalog:branches.activating')
        : t('catalog:branches.activate')}
    </Button>
  )
}
