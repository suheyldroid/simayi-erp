import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldInput } from '@/features/common/components/field-input'
import { FlagInput } from '@/features/company/components/flag-input'
import { partApi } from '@/features/part/api'
import { type Part } from '@/features/part/model'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, stockApi } from '../api'
import {
  StockModel,
  type ResultInput,
  type StockItem,
  type StockInput,
} from '../model'

const statusOptions = [
  { value: '10', label: 'OK' },
  { value: '50', label: 'Attention' },
  { value: '55', label: 'Damaged' },
  { value: '60', label: 'Destroyed' },
  { value: '65', label: 'Rejected' },
  { value: '70', label: 'Lost' },
  { value: '75', label: 'Quarantined' },
  { value: '85', label: 'Returned' },
] as const

const historyLabels: Record<number, string> = {
  1: 'Created',
  5: 'Edited',
  6: 'Serial assigned',
  10: 'Counted',
  11: 'Added',
  12: 'Removed',
  20: 'Moved',
}

function statusLabel(status: number) {
  return (
    statusOptions.find((option) => Number(option.value) === status)?.label ??
    String(status)
  )
}

export function ItemsPanel({
  part,
  permissions,
}: {
  part?: Part
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'stock', 'add')
  const canChange = hasPermission(permissions, 'stock', 'change')
  const canDelete = hasPermission(permissions, 'stock', 'delete')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<StockItem | null>(null)
  const [remove, setRemove] = useState(false)
  const items = useQuery({
    queryKey: ['stock', 'items', part?.id ?? null, page, search],
    queryFn: () => stockApi.items({ page, search, partId: part?.id }),
  })
  const history = useQuery({
    queryKey: ['stock', 'tracking', selected?.id],
    queryFn: () => stockApi.itemTracking(selected?.id ?? 0),
    enabled: selected != null,
  })
  const partHistory = useQuery({
    queryKey: ['stock', 'part-tracking', part?.id],
    queryFn: () => stockApi.partTracking(part?.id ?? 0),
    enabled: part != null,
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['stock', 'items'] })
    await client.invalidateQueries({ queryKey: ['stock', 'tracking'] })
    await client.invalidateQueries({ queryKey: ['stock', 'part-tracking'] })
  }
  const creation = useMutation({
    mutationFn: (body: StockInput) => stockApi.createItems(body),
    onSuccess: async (result) => {
      await refresh()
      setSelected(result.items[0] ?? null)
      setCreating(false)
      toast.success(
        result.items.length === 1
          ? 'Stock item created'
          : `${result.items.length} stock items created`
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (item: StockItem) => stockApi.removeItem(item.id, item.version),
    onSuccess: async () => {
      await refresh()
      setSelected(null)
      setRemove(false)
      toast.success('Stock item deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h3 className='font-medium'>Stock items</h3>
        {canAdd && !creating && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setCreating(true)}
          >
            Add stock
          </Button>
        )}
      </div>
      <p className='text-sm text-muted-foreground'>
        Trackable parts are stocked as quantity 1 with a serial number. Batch
        codes can be shared. Counting records the quantity and can move the
        item. A zero count deletes the item when delete on deplete is set.
      </p>
      <Input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        placeholder='Search part, serial, or batch'
        className='max-w-sm'
      />
      {creating && (
        <CreateStock
          part={part}
          pending={creation.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(body) => creation.mutate(body)}
        />
      )}
      {items.isPending && <p role='status'>Loading stock…</p>}
      {items.isError && <p role='alert'>{errorMessage(items.error)}</p>}
      {items.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Serial / batch</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.data.items.map((item) => (
                <TableRow
                  key={item.id}
                  data-state={selected?.id === item.id ? 'selected' : undefined}
                  onClick={() => setSelected(item)}
                >
                  <TableCell>
                    {item.part.name}
                    {item.part.ipn ? ` · ${item.part.ipn}` : ''}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {item.serial ?? '—'}
                    {item.batch ? ` · ${item.batch}` : ''}
                  </TableCell>
                  <TableCell>{item.location?.pathstring ?? '—'}</TableCell>
                  <TableCell>{statusLabel(item.status)}</TableCell>
                </TableRow>
              ))}
              {items.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No stock items yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            hasNext={
              items.data.offset + items.data.items.length < items.data.total
            }
            loading={items.isFetching}
            onChange={setPage}
          />
        </>
      )}
      {selected && (
        <ItemDetail
          item={selected}
          canChange={canChange}
          canDelete={canDelete}
          onChange={(item) => setSelected(item)}
          onDelete={() => setRemove(true)}
          history={history.data?.items ?? []}
          historyPending={history.isPending}
          historyError={history.isError ? history.error : null}
        />
      )}
      {part && (
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>Part stock history</h4>
          {partHistory.isPending && <p role='status'>Loading history…</p>}
          {partHistory.isError && (
            <p role='alert'>{errorMessage(partHistory.error)}</p>
          )}
          {partHistory.data && <HistoryTable rows={partHistory.data.items} />}
        </div>
      )}
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title='Delete stock item'
        desc='The item is removed. Its history stays on the part.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (selected) deletion.mutate(selected)
        }}
      />
    </div>
  )
}

function LocationChoice({
  label,
  onSelect,
}: {
  label: string
  onSelect: (id: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const locations = useQuery({
    queryKey: ['stock', 'locations', 'picker', search],
    queryFn: () => stockApi.locations({ search }),
    enabled: search.trim().length > 0,
  })
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder='Search locations'
      />
      {selected && (
        <p className='text-sm'>
          Selected: {selected}{' '}
          <Button
            type='button'
            variant='link'
            className='h-auto p-0'
            onClick={() => {
              setSelected('')
              onSelect(null)
            }}
          >
            Clear
          </Button>
        </p>
      )}
      <ul className='space-y-1'>
        {(locations.data?.items ?? [])
          .filter((item) => !item.structural)
          .slice(0, 8)
          .map((item) => (
            <li key={item.id}>
              <Button
                type='button'
                variant='link'
                className='h-auto p-0'
                onClick={() => {
                  setSelected(item.pathstring || item.name)
                  setSearch('')
                  onSelect(item.id)
                }}
              >
                {item.pathstring || item.name}
              </Button>
            </li>
          ))}
      </ul>
    </div>
  )
}

function CreateStock({
  part,
  pending,
  onSubmit,
  onCancel,
}: {
  part?: Part
  pending: boolean
  onSubmit: (body: StockInput) => void
  onCancel: () => void
}) {
  const [chosen, setChosen] = useState<Part | null>(part ?? null)
  const [partSearch, setPartSearch] = useState('')
  const [locationId, setLocationId] = useState<number | null>(null)
  const parts = useQuery({
    queryKey: ['part', 'parts', 'stock-picker', partSearch],
    queryFn: () => partApi.parts({ search: partSearch, limit: 8 }),
    enabled: part == null && partSearch.trim().length > 0,
  })
  const trackable = chosen?.trackable ?? false
  return (
    <form
      className='grid gap-3'
      onSubmit={(event) => {
        event.preventDefault()
        if (!chosen) {
          toast.error('Choose a part')
          return
        }
        const form = new FormData(event.currentTarget)
        const price = String(form.get('purchasePrice') ?? '').trim()
        const currency = String(form.get('purchasePriceCurrency') ?? '')
          .trim()
          .toUpperCase()
        const batch = String(form.get('batch') ?? '').trim()
        const notes = String(form.get('notes') ?? '').trim()
        try {
          onSubmit(
            StockModel.stockInput.parse({
              partId: chosen.id,
              ...(trackable
                ? { serials: String(form.get('serials') ?? '') }
                : { quantity: String(form.get('quantity') ?? '') }),
              ...(batch === '' ? {} : { batch }),
              ...(locationId == null ? {} : { locationId }),
              deleteOnDeplete: form.get('deleteOnDeplete') === 'on',
              status: Number(form.get('status') ?? 10),
              ...(price === '' ? {} : { purchasePrice: price }),
              ...(currency === '' ? {} : { purchasePriceCurrency: currency }),
              ...(notes === '' ? {} : { notes }),
            })
          )
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }}
    >
      {part == null && (
        <div className='space-y-2'>
          <Label>Part</Label>
          <Input
            value={partSearch}
            onChange={(event) => setPartSearch(event.target.value)}
            placeholder='Search parts'
          />
          {chosen && (
            <p className='text-sm'>
              Selected: {chosen.name}
              {chosen.trackable ? ' · serialized' : ''}
            </p>
          )}
          <ul className='space-y-1'>
            {(parts.data?.items ?? [])
              .filter((item) => !item.isTemplate && !item.virtual)
              .map((item) => (
                <li key={item.id}>
                  <Button
                    type='button'
                    variant='link'
                    className='h-auto p-0'
                    onClick={() => {
                      setChosen(item)
                      setPartSearch('')
                    }}
                  >
                    {item.name}
                    {item.trackable ? ' · serialized' : ''}
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {trackable ? (
        <FieldInput
          field={{
            name: 'serials',
            label: 'Serial numbers',
            required: true,
          }}
        />
      ) : (
        <FieldInput
          field={{ name: 'quantity', label: 'Quantity', required: true }}
        />
      )}
      <div className='grid gap-3 sm:grid-cols-2'>
        <FieldInput field={{ name: 'batch', label: 'Batch', maxLength: 100 }} />
        <FieldInput
          field={{
            name: 'status',
            label: 'Status',
            type: 'select',
            options: statusOptions,
            defaultValue: '10',
          }}
        />
        <FieldInput
          field={{ name: 'purchasePrice', label: 'Purchase price' }}
        />
        <FieldInput
          field={{
            name: 'purchasePriceCurrency',
            label: 'Currency',
            maxLength: 3,
          }}
        />
        <FieldInput field={{ name: 'notes', label: 'Notes', maxLength: 512 }} />
      </div>
      <LocationChoice label='Location' onSelect={setLocationId} />
      <FlagInput
        name='deleteOnDeplete'
        label='Delete when quantity reaches zero'
      />
      <div className='flex gap-2'>
        <Button type='submit' disabled={pending}>
          Create
        </Button>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ItemDetail({
  item,
  canChange,
  canDelete,
  onChange,
  onDelete,
  history,
  historyPending,
  historyError,
}: {
  item: StockItem
  canChange: boolean
  canDelete: boolean
  onChange: (item: StockItem | null) => void
  onDelete: () => void
  history: {
    id: number
    trackingType: number
    date: string
    notes: string | null
  }[]
  historyPending: boolean
  historyError: unknown
}) {
  const client = useQueryClient()
  const [countLocation, setCountLocation] = useState<number | null>(null)
  const [moveLocation, setMoveLocation] = useState<number | null>(null)
  const apply = async (item: StockItem | null) => {
    await client.invalidateQueries({ queryKey: ['stock'] })
    onChange(item)
  }
  const add = useMutation({
    mutationFn: (quantity: string) =>
      stockApi.addQuantity(item.id, { version: item.version, quantity }),
    onSuccess: async (result) => {
      await apply(result.item)
      toast.success('Quantity added')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (quantity: string) =>
      stockApi.removeQuantity(item.id, { version: item.version, quantity }),
    onSuccess: async (result) => {
      await apply(result.deleted ? null : result.item)
      toast.success(result.deleted ? 'Stock item depleted' : 'Quantity removed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const count = useMutation({
    mutationFn: (input: { quantity: string; locationId?: number }) =>
      stockApi.countItem(item.id, { version: item.version, ...input }),
    onSuccess: async (result) => {
      await apply(result.deleted ? null : result.item)
      toast.success(result.deleted ? 'Stock item depleted' : 'Stock counted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const move = useMutation({
    mutationFn: (locationId: number) =>
      stockApi.moveItem(item.id, { version: item.version, locationId }),
    onSuccess: async (result) => {
      await apply(result.item)
      toast.success('Stock moved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h4 className='font-medium'>
            {item.part.name}
            {item.serial ? ` · ${item.serial}` : ''}
          </h4>
          <p className='text-sm text-muted-foreground'>
            Quantity {item.quantity}
            {item.batch ? ` · batch ${item.batch}` : ''}
            {item.location ? ` · ${item.location.pathstring}` : ''}
            {` · ${statusLabel(item.status)} · version ${item.version}`}
            {item.purchaseOrder
              ? ` · order ${item.purchaseOrder.reference}`
              : ''}
            {item.isBuilding ? ' · in production' : ''}
            {item.build ? ` · build ${item.build.reference}` : ''}
            {item.consumedBy
              ? ` · consumed by ${item.consumedBy.reference}`
              : ''}
          </p>
        </div>
        {canDelete && (
          <Button type='button' variant='outline' onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
      {canChange && item.serial == null && (
        <div className='grid gap-3 md:grid-cols-2'>
          <QuantityForm
            label='Add quantity'
            pending={add.isPending}
            onSubmit={(quantity) => add.mutate(quantity)}
          />
          <QuantityForm
            label='Remove quantity'
            pending={remove.isPending}
            onSubmit={(quantity) => remove.mutate(quantity)}
          />
        </div>
      )}
      {canChange && (
        <form
          className='grid gap-3'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
              const parsed = StockModel.countInput.parse({
                version: item.version,
                quantity: String(form.get('quantity') ?? ''),
                ...(countLocation == null ? {} : { locationId: countLocation }),
              })
              count.mutate({
                quantity: parsed.quantity,
                locationId: parsed.locationId,
              })
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          <FieldInput
            key={item.quantity}
            field={{
              name: 'quantity',
              label: 'Counted quantity',
              required: true,
            }}
            value={item.quantity}
          />
          <LocationChoice
            label='Count at location'
            onSelect={setCountLocation}
          />
          <Button className='w-fit' type='submit' disabled={count.isPending}>
            Count
          </Button>
        </form>
      )}
      {canChange && (
        <form
          className='grid gap-3'
          onSubmit={(event) => {
            event.preventDefault()
            if (moveLocation == null) {
              toast.error('Choose a location')
              return
            }
            move.mutate(moveLocation)
          }}
        >
          <LocationChoice label='Move to' onSelect={setMoveLocation} />
          <Button className='w-fit' type='submit' disabled={move.isPending}>
            Move
          </Button>
        </form>
      )}
      <div className='space-y-2'>
        <h4 className='text-sm font-medium'>History</h4>
        {historyPending && <p role='status'>Loading history…</p>}
        {historyError != null && (
          <p role='alert'>{errorMessage(historyError)}</p>
        )}
        <HistoryTable rows={history} />
      </div>
      {item.part.testable && (
        <TestResults item={item} canChange={canChange} canDelete={canDelete} />
      )}
    </div>
  )
}

function QuantityForm({
  label,
  pending,
  onSubmit,
}: {
  label: string
  pending: boolean
  onSubmit: (quantity: string) => void
}) {
  return (
    <form
      className='flex items-end gap-2'
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const quantity = String(form.get('quantity') ?? '')
        try {
          StockModel.quantityInput.parse({ version: 0, quantity })
          onSubmit(quantity)
          event.currentTarget.reset()
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }}
    >
      <FieldInput field={{ name: 'quantity', label, required: true }} />
      <Button type='submit' disabled={pending}>
        Apply
      </Button>
    </form>
  )
}

function HistoryTable({
  rows,
}: {
  rows: {
    id: number
    trackingType: number
    date: string
    notes: string | null
  }[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.date.replace('T', ' ').slice(0, 19)}</TableCell>
            <TableCell>
              {historyLabels[row.trackingType] ?? row.trackingType}
            </TableCell>
            <TableCell>{row.notes ?? '—'}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={3}>No history yet.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function TestResults({
  item,
  canChange,
  canDelete,
}: {
  item: StockItem
  canChange: boolean
  canDelete: boolean
}) {
  const client = useQueryClient()
  const results = useQuery({
    queryKey: ['stock', 'tests', item.id],
    queryFn: () => stockApi.testResults(item.id),
  })
  const templates = useQuery({
    queryKey: ['part', 'tests', item.partId],
    queryFn: () => stockApi.testTemplates(item.partId),
  })
  const [remove, setRemove] = useState<number | null>(null)
  const save = useMutation({
    mutationFn: (body: ResultInput) => stockApi.addTestResult(item.id, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['stock', 'tests', item.id] })
      toast.success('Test result recorded')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (id: number) => stockApi.removeTestResult(item.id, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['stock', 'tests', item.id] })
      setRemove(null)
      toast.success('Test result deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const enabled = (templates.data?.items ?? []).filter((row) => row.enabled)
  return (
    <div className='space-y-2'>
      <h4 className='text-sm font-medium'>Test results</h4>
      {canChange && (
        <form
          className='grid gap-3 sm:grid-cols-2'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const value = String(form.get('value') ?? '').trim()
            const attachment = String(form.get('attachment') ?? '').trim()
            try {
              save.mutate(
                StockModel.resultInput.parse({
                  templateId: Number(form.get('templateId')),
                  result: form.get('result') === 'on',
                  ...(value === '' ? {} : { value }),
                  ...(attachment === '' ? {} : { attachment }),
                  notes: String(form.get('notes') ?? ''),
                  testStation: String(form.get('testStation') ?? ''),
                })
              )
              event.currentTarget.reset()
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          <FieldInput
            field={{
              name: 'templateId',
              label: 'Template',
              type: 'select',
              required: true,
              options: enabled.map((row) => ({
                value: String(row.id),
                label: row.testName,
              })),
            }}
          />
          <FlagInput name='result' label='Passed' />
          <FieldInput
            field={{ name: 'value', label: 'Value', maxLength: 500 }}
          />
          <FieldInput
            field={{
              name: 'attachment',
              label: 'Attachment path',
              maxLength: 100,
            }}
          />
          <FieldInput
            field={{ name: 'notes', label: 'Notes', maxLength: 500 }}
          />
          <FieldInput
            field={{
              name: 'testStation',
              label: 'Test station',
              maxLength: 500,
            }}
          />
          <Button
            type='submit'
            disabled={save.isPending || enabled.length === 0}
          >
            Record result
          </Button>
        </form>
      )}
      {results.isPending && <p role='status'>Loading test results…</p>}
      {results.isError && <p role='alert'>{errorMessage(results.error)}</p>}
      {results.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Value</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.template.testName}
                  {row.current ? '' : ' · earlier'}
                </TableCell>
                <TableCell>{row.result ? 'Pass' : 'Fail'}</TableCell>
                <TableCell>{row.value || '—'}</TableCell>
                <TableCell>
                  {canDelete && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setRemove(row.id)}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {results.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No test results yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={remove != null}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title='Delete test result'
        desc='This recorded result will be removed.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (remove != null) deletion.mutate(remove)
        }}
      />
    </div>
  )
}
