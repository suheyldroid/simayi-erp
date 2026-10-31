import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { errorMessage } from '@/features/common/api'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { currencyApi } from '../api'
import { CurrencyModel, type Backend, type Snapshot } from '../model'

function SnapshotEditor({
  backend,
  initial,
  onSaved,
}: {
  backend: Backend
  initial: string
  onSaved: () => Promise<void>
}) {
  const [pending, setPending] = useState<Snapshot | null>(null)
  const save = useMutation({
    mutationFn: (form: FormData) => {
      const rates = String(form.get('rates') ?? '')
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => {
          const [currency, value, extra] = line.trim().split(/[\s,;]+/)
          return { currency, value: extra === undefined ? value : '' }
        })
      const snapshot = CurrencyModel.snapshot.parse({ rates })
      setPending(snapshot)
      return Promise.resolve()
    },
  })
  const commit = useMutation({
    mutationFn: (body: Snapshot) => currencyApi.saveRates(backend.name, body),
    onSuccess: async () => {
      setPending(null)
      await onSaved()
      toast.success('Manual rate snapshot saved.')
    },
  })
  return (
    <form
      className='space-y-3 rounded-md border p-4'
      onSubmit={(event) => {
        event.preventDefault()
        commit.reset()
        save.mutate(new FormData(event.currentTarget))
      }}
    >
      <h3 className='font-semibold'>Replace manual snapshot</h3>
      <Label htmlFor='manual-rates'>
        One currency and decimal rate per line
      </Label>
      <Textarea
        id='manual-rates'
        name='rates'
        required
        rows={8}
        maxLength={30000}
        defaultValue={initial}
        placeholder={'EUR,0.920000\nTRY,34.500000'}
        disabled={commit.isPending}
      />
      <p className='text-sm text-muted-foreground'>
        All values are decimal strings with at most six decimal places. Saving
        removes omitted currencies. The base rate is always one.
      </p>
      <Button disabled={save.isPending || commit.isPending}>
        Review snapshot
      </Button>
      {save.isError && (
        <p role='alert' className='text-destructive'>
          {errorMessage(save.error)}
        </p>
      )}
      {commit.isError && (
        <p role='alert' className='text-destructive'>
          {errorMessage(commit.error)}
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !commit.isPending) setPending(null)
        }}
        title='Replace all manual rates'
        desc={`Replace the ${backend.baseCurrency} snapshot with ${pending?.rates.length ?? 0} submitted rates? Omitted rates will be deleted.`}
        confirmText='Replace snapshot'
        isLoading={commit.isPending}
        handleConfirm={() => {
          if (pending) commit.mutate(pending)
        }}
      />
    </form>
  )
}
export function RatesPanel({
  backend,
  effective,
}: {
  backend: Backend
  effective: EffectivePermissions
}) {
  const client = useQueryClient()
  const [deleting, setDeleting] = useState<string | null>(null)
  const rates = useQuery({
    queryKey: ['currency', 'rates', backend.name, backend.version],
    queryFn: () => currencyApi.rates(backend.name),
  })
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['currency'] })
  }
  const deletion = useMutation({
    mutationFn: (currency: string) =>
      currencyApi.removeRate(backend.name, currency),
    onSuccess: async () => {
      setDeleting(null)
      await invalidate()
      toast.success('Rate deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const manual = backend.name === 'manual'
  const canEdit = manual && hasPermission(effective, 'admin', 'change')
  const canDelete = manual && hasPermission(effective, 'admin', 'delete')
  return (
    <section className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-semibold'>
          Rates relative to {backend.baseCurrency}
        </h3>
        <Button
          variant='outline'
          disabled={rates.isFetching}
          onClick={() => void rates.refetch()}
        >
          Reload rates
        </Button>
      </div>
      {rates.isPending && <p role='status'>Loading rates…</p>}
      {rates.isError && (
        <p role='alert' className='text-destructive'>
          {errorMessage(rates.error)}
        </p>
      )}
      {rates.data && !rates.isError && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Rate</TableHead>
                {canDelete && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.data.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>
                    {rate.currency}
                    {rate.currency === backend.baseCurrency ? ' (base)' : ''}
                  </TableCell>
                  <TableCell className='font-mono'>{rate.value}</TableCell>
                  {canDelete && (
                    <TableCell>
                      {rate.currency !== backend.baseCurrency && (
                        <Button
                          variant='outline'
                          onClick={() => setDeleting(rate.currency)}
                          aria-label={`Delete ${rate.currency} rate`}
                        >
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {canEdit && (
            <SnapshotEditor
              key={`${backend.name}:${backend.version}`}
              backend={backend}
              initial={rates.data
                .map((rate) => `${rate.currency},${rate.value}`)
                .join('\n')}
              onSaved={invalidate}
            />
          )}
        </>
      )}
      {!manual && (
        <p className='text-sm text-muted-foreground'>
          Provider rates are read-only. Use Refresh provider to replace the
          snapshot.
        </p>
      )}
      <ConfirmDialog
        open={deleting !== null && canDelete}
        onOpenChange={(open) => {
          if (!open && !deletion.isPending) setDeleting(null)
        }}
        title='Delete rate'
        desc={`Remove ${deleting ?? ''} from the manual snapshot? Conversion will fail when this rate is required.`}
        destructive
        confirmText='Delete rate'
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (deleting) deletion.mutate(deleting)
        }}
      />
    </section>
  )
}
