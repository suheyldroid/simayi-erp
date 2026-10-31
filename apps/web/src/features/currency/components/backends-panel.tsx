import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { errorMessage } from '@/features/common/api'
import { FieldInput } from '@/features/common/components/field-input'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { currencyApi } from '../api'
import { CurrencyModel, type Backend, type BackendName } from '../model'
import { RatesPanel } from './rates-panel'

function BackendWorkspace({
  backend,
  effective,
}: {
  backend: Backend
  effective: EffectivePermissions
}) {
  const client = useQueryClient()
  const [newBase, setNewBase] = useState<string | null>(null)
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['currency'] })
  }
  const refresh = useMutation({
    mutationFn: () => currencyApi.refresh(backend.name),
    onSuccess: async () => {
      await invalidate()
      toast.success('Provider refreshed.')
    },
  })
  const update = useMutation({
    mutationFn: (base: string) => currencyApi.update(backend.name, base),
    onSuccess: async () => {
      setNewBase(null)
      await invalidate()
      toast.success('Base changed. Populate the new rate snapshot.')
    },
  })
  const canEdit = hasPermission(effective, 'admin', 'change')
  return (
    <section className='space-y-5 rounded-md border p-4'>
      <h2 className='text-xl font-semibold'>{backend.name}</h2>
      <p className='text-sm text-muted-foreground'>
        Last snapshot ingestion: {new Date(backend.lastUpdate).toLocaleString()}
        . Rates are refreshed automatically for the selected Frankfurter
        backend. Stale cross-currency conversions are rejected.
      </p>
      {canEdit && (
        <>
          {backend.name === 'frankfurter' && (
            <Button
              disabled={refresh.isPending || update.isPending}
              onClick={() => refresh.mutate()}
            >
              Refresh provider
            </Button>
          )}
          <form
            key={backend.baseCurrency}
            className='flex flex-wrap items-end gap-3'
            onSubmit={(event) => {
              event.preventDefault()
              const value = String(
                new FormData(event.currentTarget).get('baseCurrency') ?? ''
              )
              update.reset()
              if (value !== backend.baseCurrency) setNewBase(value)
            }}
          >
            <FieldInput
              field={{
                name: 'baseCurrency',
                label: 'Base currency',
                required: true,
                pattern: '[A-Z]{3}',
                maxLength: 3,
              }}
              value={backend.baseCurrency}
            />
            <Button
              variant='outline'
              disabled={refresh.isPending || update.isPending}
            >
              Change base
            </Button>
          </form>
          {refresh.isError && (
            <p role='alert' className='text-destructive'>
              {errorMessage(refresh.error)}
            </p>
          )}
          {update.isError && (
            <p role='alert' className='text-destructive'>
              {errorMessage(update.error)}
            </p>
          )}
        </>
      )}
      <RatesPanel backend={backend} effective={effective} />
      <ConfirmDialog
        open={newBase !== null && canEdit}
        onOpenChange={(open) => {
          if (!open && !update.isPending) setNewBase(null)
        }}
        title='Change base currency'
        desc={`Changing ${backend.baseCurrency} to ${newBase ?? ''} deletes all previous rates. Only the new base rate of one remains until you refresh or submit a new manual snapshot.`}
        destructive
        confirmText='Change base and clear rates'
        isLoading={update.isPending}
        handleConfirm={() => {
          if (newBase) update.mutate(newBase)
        }}
      />
    </section>
  )
}
export function BackendsPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<BackendName | null>(null)
  const [deleting, setDeleting] = useState<Backend | null>(null)
  const backends = useQuery({
    queryKey: ['currency', 'backends'],
    queryFn: currencyApi.backends,
    refetchInterval: 60000,
  })
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['currency'] })
  }
  const create = useMutation({
    mutationFn: (form: FormData) => {
      const body = CurrencyModel.backendInput.parse(Object.fromEntries(form))
      return currencyApi.create(body.name, body.baseCurrency)
    },
    onSuccess: async (backend) => {
      setSelected(backend.name)
      await invalidate()
      toast.success('Backend created.')
    },
  })
  const deletion = useMutation({
    mutationFn: (name: BackendName) => currencyApi.remove(name),
    onSuccess: async () => {
      setDeleting(null)
      setSelected(null)
      await invalidate()
      toast.success('Backend and rates deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const backend = backends.isError
    ? undefined
    : backends.data?.find((item) => item.name === selected)
  const canDelete = hasPermission(effective, 'admin', 'delete')
  return (
    <div className='space-y-5'>
      {hasPermission(effective, 'admin', 'add') && (
        <form
          className='space-y-3 rounded-md border p-4'
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate(new FormData(event.currentTarget))
          }}
        >
          <h2 className='font-semibold'>Add exchange backend</h2>
          <fieldset
            disabled={create.isPending}
            className='flex flex-wrap items-end gap-3'
          >
            <FieldInput
              field={{
                name: 'name',
                label: 'Provider',
                type: 'select',
                required: true,
                defaultValue: 'frankfurter',
                options: [
                  { value: 'frankfurter', label: 'Frankfurter (automatic)' },
                  { value: 'manual', label: 'Manual' },
                ],
              }}
            />
            <FieldInput
              field={{
                name: 'baseCurrency',
                label: 'Base currency',
                required: true,
                pattern: '[A-Z]{3}',
                maxLength: 3,
                defaultValue: 'USD',
              }}
            />
            <Button disabled={create.isPending}>Create backend</Button>
          </fieldset>
          {create.isError && (
            <p role='alert' className='text-destructive'>
              {errorMessage(create.error)}
            </p>
          )}
        </form>
      )}
      {backends.isPending && <p role='status'>Loading backends…</p>}
      {backends.isError && (
        <div role='alert'>
          {errorMessage(backends.error)}{' '}
          <Button variant='outline' onClick={() => void backends.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {backends.data && !backends.isError && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Last ingestion</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backends.data.map((item) => (
              <TableRow key={item.name}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.baseCurrency}</TableCell>
                <TableCell>
                  {new Date(item.lastUpdate).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      onClick={() => setSelected(item.name)}
                      aria-label={`Manage ${item.name}`}
                    >
                      Manage rates
                    </Button>
                    {canDelete && (
                      <Button
                        variant='outline'
                        onClick={() => setDeleting(item)}
                        aria-label={`Delete ${item.name}`}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!backends.data.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  No backend configured. Add one before converting.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      {backend && (
        <BackendWorkspace
          key={backend.name}
          backend={backend}
          effective={effective}
        />
      )}
      <ConfirmDialog
        open={deleting !== null && canDelete}
        onOpenChange={(open) => {
          if (!open && !deletion.isPending) setDeleting(null)
        }}
        title='Delete exchange backend'
        desc={`Delete ${deleting?.name ?? ''} and all its rates? Conversions using this provider will fail until it is configured again.`}
        destructive
        confirmText='Delete backend'
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (deleting) deletion.mutate(deleting.name)
        }}
      />
    </div>
  )
}
