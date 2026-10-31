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
import { partApi } from '@/features/part/api'
import { stockApi } from '@/features/stock/api'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, manufacturingApi } from '../api'
import type { BuildAllocation, BuildLine, BuildOrder } from '../model'

const statusLabel: Record<BuildOrder['status'], string> = {
  10: 'Pending',
  20: 'Production',
  25: 'On hold',
  30: 'Cancelled',
  40: 'Complete',
}

export function BuildsPanel({
  permissions,
}: {
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'build', 'add')
  const canChange = hasPermission(permissions, 'build', 'change')
  const canDelete = hasPermission(permissions, 'build', 'delete')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [openOnly, setOpenOnly] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<BuildOrder | null>(null)
  const builds = useQuery({
    queryKey: ['manufacturing', 'builds', page, search, openOnly],
    queryFn: () => manufacturingApi.builds({ page, search, open: openOnly }),
  })
  const refresh = async (build?: BuildOrder | null) => {
    await client.invalidateQueries({ queryKey: ['manufacturing'] })
    await client.invalidateQueries({ queryKey: ['stock'] })
    if (build === null) {
      setSelected(null)
      return
    }
    const id = build?.id ?? selected?.id
    if (id != null) setSelected(await manufacturingApi.build(id))
  }
  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='space-y-2'>
          <Label htmlFor='build-search'>Search</Label>
          <Input
            id='build-search'
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
          />
        </div>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={openOnly}
            onChange={(event) => {
              setOpenOnly(event.target.checked)
              setPage(0)
            }}
          />
          Open only
        </label>
        {canAdd && (
          <Button type='button' onClick={() => setCreating((value) => !value)}>
            {creating ? 'Close' : 'New build'}
          </Button>
        )}
      </div>
      {creating && canAdd && (
        <CreateBuild
          onCreated={async (build) => {
            await refresh(build)
            setCreating(false)
            toast.success(`Build ${build.reference} created`)
          }}
        />
      )}
      {builds.isPending && <p role='status'>Loading builds…</p>}
      {builds.isError && <p role='alert'>{errorMessage(builds.error)}</p>}
      {builds.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {builds.data.items.map((build) => (
                <TableRow
                  key={build.id}
                  data-state={
                    selected?.id === build.id ? 'selected' : undefined
                  }
                  className='cursor-pointer'
                  onClick={() => setSelected(build)}
                >
                  <TableCell>{build.reference}</TableCell>
                  <TableCell>{build.part.name}</TableCell>
                  <TableCell>
                    {build.completed}/{build.quantity}
                  </TableCell>
                  <TableCell>{statusLabel[build.status]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            loading={builds.isFetching}
            hasNext={(page + 1) * builds.data.limit < builds.data.total}
            onChange={setPage}
          />
        </>
      )}
      {selected && (
        <BuildDetail
          build={selected}
          canChange={canChange}
          canDelete={canDelete}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

function CreateBuild({
  onCreated,
}: {
  onCreated: (build: BuildOrder) => Promise<void>
}) {
  const [partSearch, setPartSearch] = useState('')
  const [partId, setPartId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [title, setTitle] = useState('')
  const [reference, setReference] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [takeFromId, setTakeFromId] = useState('')
  const parts = useQuery({
    queryKey: ['manufacturing', 'parts', partSearch],
    queryFn: () =>
      partApi.parts({ search: partSearch, assembly: true, limit: 8 }),
  })
  const locations = useQuery({
    queryKey: ['stock', 'locations', 'build'],
    queryFn: () => stockApi.locations({}),
  })
  const create = useMutation({
    mutationFn: manufacturingApi.create,
    onSuccess: (build) => onCreated(build),
    onError: (error) => toast.error(errorMessage(error)),
  })
  const assemblies =
    parts.data?.items.filter(
      (part) =>
        part.assembly && !part.isTemplate && !part.virtual && part.active
    ) ?? []
  const places = locations.data?.items.filter((item) => !item.structural) ?? []
  return (
    <form
      className='grid gap-3 rounded-lg border p-3 md:grid-cols-2'
      onSubmit={(event) => {
        event.preventDefault()
        if (partId == null) {
          toast.error('Choose an assembly')
          return
        }
        const amount = Number(quantity)
        if (!Number.isInteger(amount) || amount < 1) {
          toast.error('Quantity must be a positive whole number')
          return
        }
        create.mutate({
          partId,
          quantity: amount,
          title: title || undefined,
          reference: reference || undefined,
          destinationId: destinationId ? Number(destinationId) : undefined,
          takeFromId: takeFromId ? Number(takeFromId) : undefined,
        })
      }}
    >
      <div className='space-y-2 md:col-span-2'>
        <Label htmlFor='assembly-search'>Assembly</Label>
        <Input
          id='assembly-search'
          value={partSearch}
          onChange={(event) => setPartSearch(event.target.value)}
        />
        <select
          className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
          value={partId ?? ''}
          onChange={(event) =>
            setPartId(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value=''>Choose an assembly</option>
          {assemblies.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name}
            </option>
          ))}
        </select>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='build-quantity'>Quantity</Label>
        <Input
          id='build-quantity'
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='build-title'>Title</Label>
        <Input
          id='build-title'
          value={title}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='build-reference'>Reference</Label>
        <Input
          id='build-reference'
          value={reference}
          maxLength={64}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
      <LocationSelect
        id='build-destination'
        label='Destination'
        value={destinationId}
        places={places}
        onChange={setDestinationId}
      />
      <LocationSelect
        id='build-source'
        label='Source location'
        value={takeFromId}
        places={places}
        onChange={setTakeFromId}
      />
      <Button type='submit' disabled={create.isPending}>
        Create build
      </Button>
    </form>
  )
}

function LocationSelect({
  id,
  label,
  value,
  places,
  onChange,
}: {
  id: string
  label: string
  value: string
  places: Array<{ id: number; pathstring: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value=''>None</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.pathstring}
          </option>
        ))}
      </select>
    </div>
  )
}

function BuildDetail({
  build,
  canChange,
  canDelete,
  onChanged,
}: {
  build: BuildOrder
  canChange: boolean
  canDelete: boolean
  onChanged: (build?: BuildOrder | null) => Promise<void>
}) {
  const editable = build.status === 10 || build.status === 20
  const lines = useQuery({
    queryKey: ['manufacturing', 'lines', build.id, build.version],
    queryFn: () => manufacturingApi.lines(build.id),
  })
  const allocations = useQuery({
    queryKey: ['manufacturing', 'allocations', build.id, build.version],
    queryFn: () => manufacturingApi.allocations(build.id),
  })
  const outputs = useQuery({
    queryKey: ['manufacturing', 'outputs', build.id, build.version],
    queryFn: () => manufacturingApi.outputs(build.id),
  })
  const act = useMutation({
    mutationFn: (input: {
      action: 'issue' | 'hold' | 'cancel' | 'complete'
      acceptIncomplete?: boolean
      acceptUnallocated?: boolean
    }) =>
      manufacturingApi.act(build.id, input.action, {
        version: build.version,
        acceptIncomplete: input.acceptIncomplete,
        acceptUnallocated: input.acceptUnallocated,
      }),
    onSuccess: async (next) => {
      await onChanged(next)
      toast.success(`Build ${next.reference} updated`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: () => manufacturingApi.remove(build),
    onSuccess: async () => {
      await onChanged(null)
      toast.success('Build deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <section className='space-y-4 rounded-lg border p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>
            {build.reference}
            {build.title ? ` · ${build.title}` : ''}
          </h2>
          <p className='text-sm text-muted-foreground'>
            {build.part.name} · {build.completed}/{build.quantity} ·{' '}
            {statusLabel[build.status]} · version {build.version}
          </p>
        </div>
        {canChange && (
          <div className='flex flex-wrap gap-2'>
            {(build.status === 10 || build.status === 25) && (
              <Button
                type='button'
                onClick={() => act.mutate({ action: 'issue' })}
              >
                Issue
              </Button>
            )}
            {(build.status === 10 || build.status === 20) && (
              <Button
                type='button'
                variant='outline'
                onClick={() => act.mutate({ action: 'hold' })}
              >
                Hold
              </Button>
            )}
            {build.status !== 30 && build.status !== 40 && (
              <Button
                type='button'
                variant='outline'
                onClick={() => act.mutate({ action: 'cancel' })}
              >
                Cancel
              </Button>
            )}
            {build.status === 20 && (
              <>
                <Button
                  type='button'
                  onClick={() => act.mutate({ action: 'complete' })}
                >
                  Complete
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() =>
                    act.mutate({
                      action: 'complete',
                      acceptIncomplete: true,
                      acceptUnallocated: true,
                    })
                  }
                >
                  Complete short
                </Button>
              </>
            )}
          </div>
        )}
        {canDelete && (build.status === 10 || build.status === 30) && (
          <Button
            type='button'
            variant='outline'
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
        )}
      </div>
      {lines.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Allocated</TableHead>
              <TableHead>Consumed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.data.items.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  {line.part.name}
                  {line.optional ? ' · optional' : ''}
                  {line.trackable ? ' · tracked' : ''}
                </TableCell>
                <TableCell>{line.quantity}</TableCell>
                <TableCell>{line.allocated}</TableCell>
                <TableCell>{line.consumed}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {canChange && editable && lines.data && (
        <AllocateForm
          build={build}
          lines={lines.data.items}
          outputs={outputs.data?.items.filter((item) => item.isBuilding) ?? []}
          onChanged={onChanged}
        />
      )}
      {allocations.data && (
        <AllocationList
          build={build}
          items={allocations.data.items}
          canChange={canChange && build.status === 20}
          canEdit={canChange && editable}
          onChanged={onChanged}
        />
      )}
      {outputs.data && (
        <OutputList
          build={build}
          items={outputs.data.items}
          canChange={canChange}
          onChanged={onChanged}
        />
      )}
      {canChange && editable && (
        <OutputForm build={build} onChanged={onChanged} />
      )}
    </section>
  )
}

function AllocateForm({
  build,
  lines,
  outputs,
  onChanged,
}: {
  build: BuildOrder
  lines: BuildLine[]
  outputs: Array<{ id: number; serial: string | null; quantity: string }>
  onChanged: (build?: BuildOrder | null) => Promise<void>
}) {
  const [lineId, setLineId] = useState(lines[0]?.id ?? 0)
  const [stockId, setStockId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [outputId, setOutputId] = useState('')
  const line = lines.find((item) => item.id === lineId) ?? lines[0]
  const partIds = line
    ? [line.part.id, ...line.substitutes.map((item) => item.id)]
    : []
  const stock = useQuery({
    queryKey: ['manufacturing', 'stock', partIds],
    enabled: partIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        partIds.map((partId) => stockApi.items({ partId, limit: 20 }))
      )
      return pages.flatMap((page) => page.items)
    },
  })
  const allocate = useMutation({
    mutationFn: () => {
      if (!line) throw new Error('Choose a line')
      return manufacturingApi.allocate(build.id, {
        version: build.version,
        items: [
          {
            buildLineId: line.id,
            stockItemId: Number(stockId),
            quantity,
            outputId: line.trackable ? Number(outputId) : null,
          },
        ],
      })
    },
    onSuccess: async (next) => {
      await onChanged(next)
      toast.success('Stock allocated')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  if (!line) return null
  return (
    <form
      className='grid gap-3 md:grid-cols-2'
      onSubmit={(event) => {
        event.preventDefault()
        allocate.mutate()
      }}
    >
      <div className='space-y-2'>
        <Label htmlFor='allocate-line'>Line</Label>
        <select
          id='allocate-line'
          className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
          value={line.id}
          onChange={(event) => setLineId(Number(event.target.value))}
        >
          {lines.map((item) => (
            <option key={item.id} value={item.id}>
              {item.part.name}
            </option>
          ))}
        </select>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='allocate-stock'>Stock</Label>
        <select
          id='allocate-stock'
          className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
          value={stockId}
          onChange={(event) => setStockId(event.target.value)}
          required
        >
          <option value=''>Choose stock</option>
          {stock.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.part.name} · {item.quantity}
              {item.serial ? ` · ${item.serial}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='allocate-quantity'>Quantity</Label>
        <Input
          id='allocate-quantity'
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </div>
      {line.trackable && (
        <div className='space-y-2'>
          <Label htmlFor='allocate-output'>Output</Label>
          <select
            id='allocate-output'
            className='h-9 w-full rounded-md border bg-transparent px-3 text-sm'
            value={outputId}
            onChange={(event) => setOutputId(event.target.value)}
            required
          >
            <option value=''>Choose an incomplete output</option>
            {outputs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.serial ?? `Output ${item.id}`} · {item.quantity}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type='submit' disabled={allocate.isPending}>
        Allocate
      </Button>
    </form>
  )
}

function AllocationList({
  build,
  items,
  canChange,
  canEdit,
  onChanged,
}: {
  build: BuildOrder
  items: BuildAllocation[]
  canChange: boolean
  canEdit: boolean
  onChanged: (build?: BuildOrder | null) => Promise<void>
}) {
  const [chosen, setChosen] = useState<number[]>([])
  const consume = useMutation({
    mutationFn: () => manufacturingApi.consume(build.id, build.version, chosen),
    onSuccess: async (next) => {
      setChosen([])
      await onChanged(next)
      toast.success('Stock consumed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (id: number) =>
      manufacturingApi.removeAllocation(build.id, id, build.version),
    onSuccess: async (next) => {
      await onChanged(next)
      toast.success('Allocation removed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  if (items.length === 0) return null
  return (
    <div className='space-y-2'>
      <h3 className='font-medium'>Allocations</h3>
      <ul className='space-y-2 text-sm'>
        {items.map((item) => (
          <li key={item.id} className='flex flex-wrap items-center gap-2'>
            {canChange && (
              <input
                type='checkbox'
                aria-label={`Consume ${item.stockItem.partName}`}
                checked={chosen.includes(item.id)}
                onChange={(event) =>
                  setChosen((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id)
                  )
                }
              />
            )}
            <span>
              {item.stockItem.partName} · {item.quantity}
              {item.stockItem.serial ? ` · ${item.stockItem.serial}` : ''}
              {item.output ? ` · output ${item.output.id}` : ''}
            </span>
            {canEdit && (
              <Button
                type='button'
                variant='outline'
                onClick={() => remove.mutate(item.id)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canChange && chosen.length > 0 && (
        <Button type='button' onClick={() => consume.mutate()}>
          Consume selected
        </Button>
      )}
    </div>
  )
}

function OutputList({
  build,
  items,
  canChange,
  onChanged,
}: {
  build: BuildOrder
  items: Array<{
    id: number
    quantity: string
    serial: string | null
    isBuilding: boolean
    status: number
  }>
  canChange: boolean
  onChanged: (build?: BuildOrder | null) => Promise<void>
}) {
  const finish = useMutation({
    mutationFn: (id: number) =>
      manufacturingApi.finishOutput(build.id, id, { version: build.version }),
    onSuccess: async (next) => {
      await onChanged(next)
      toast.success('Output completed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const scrap = useMutation({
    mutationFn: (id: number) =>
      manufacturingApi.scrapOutput(build.id, id, build.version),
    onSuccess: async (next) => {
      await onChanged(next)
      toast.success('Output scrapped')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  if (items.length === 0) return null
  return (
    <div className='space-y-2'>
      <h3 className='font-medium'>Outputs</h3>
      <ul className='space-y-2 text-sm'>
        {items.map((item) => (
          <li key={item.id} className='flex flex-wrap items-center gap-2'>
            <span>
              {item.serial ?? `Output ${item.id}`} · {item.quantity}
              {item.isBuilding ? ' · in production' : ''}
            </span>
            {canChange && item.isBuilding && build.status === 20 && (
              <Button type='button' onClick={() => finish.mutate(item.id)}>
                Complete
              </Button>
            )}
            {canChange &&
              item.isBuilding &&
              (build.status === 10 || build.status === 20) && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => scrap.mutate(item.id)}
                >
                  Scrap
                </Button>
              )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function OutputForm({
  build,
  onChanged,
}: {
  build: BuildOrder
  onChanged: (build?: BuildOrder | null) => Promise<void>
}) {
  const [quantity, setQuantity] = useState('1')
  const [serials, setSerials] = useState('')
  const create = useMutation({
    mutationFn: () =>
      manufacturingApi.createOutput(build.id, {
        version: build.version,
        quantity,
        serials: serials || undefined,
      }),
    onSuccess: async (next) => {
      await onChanged(next)
      toast.success('Output created')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <form
      className='grid gap-3 md:grid-cols-2'
      onSubmit={(event) => {
        event.preventDefault()
        create.mutate()
      }}
    >
      <div className='space-y-2'>
        <Label htmlFor='output-quantity'>Output quantity</Label>
        <Input
          id='output-quantity'
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='output-serials'>Serials</Label>
        <Input
          id='output-serials'
          value={serials}
          onChange={(event) => setSerials(event.target.value)}
        />
      </div>
      <Button type='submit' disabled={create.isPending}>
        Create output
      </Button>
    </form>
  )
}
