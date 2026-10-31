import { useState } from 'react'
import { ZodError } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldInput } from '@/features/common/components/field-input'
import { FlagInput } from '@/features/company/components/flag-input'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { errorMessage, stockApi } from '../api'
import { StockModel, type Location, type LocationInput } from '../model'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function parseLocation(form: FormData, creating: boolean): LocationInput {
  try {
    const metadata = text(form, 'metadata').trim()
    const owner = text(form, 'ownerId').trim()
    return StockModel.locationBody.parse({
      name: text(form, 'name'),
      description: text(form, 'description'),
      parentId: text(form, 'parentId'),
      barcodeData: text(form, 'barcodeData'),
      customIcon: text(form, 'customIcon').trim() || null,
      ownerId: owner ? Number(owner) : creating ? undefined : null,
      structural: form.has('structural'),
      external: form.has('external'),
      locationTypeId: text(form, 'locationTypeId'),
      metadata: metadata ? JSON.parse(metadata) : null,
    })
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new ZodError([
        {
          code: 'custom',
          path: ['metadata'],
          message: 'Enter a valid JSON object.',
        },
      ])
    throw error
  }
}

function LocationForm({
  location,
  parent,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  location: Location | 'new'
  parent: Location | null
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: LocationInput) => void
}) {
  const creating = location === 'new'
  const current = creating ? undefined : location
  const types = useQuery({
    queryKey: ['stock', 'location-types', 'options'],
    queryFn: () => stockApi.locationTypes(0, ''),
  })
  const parentId = current?.parentId ?? parent?.id ?? ''
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {creating ? 'Create location' : 'Edit location'}
          </DialogTitle>
          <DialogDescription>
            A blank owner on a new child location inherits the parent owner.
            Changing an owner updates child locations, except a child user who
            already belongs to the selected group. Owner IDs are listed under
            Users → Ownership.
          </DialogDescription>
        </DialogHeader>
        <form
          key={creating ? `new-${parent?.id ?? 'root'}` : location.id}
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(parseLocation(new FormData(event.currentTarget), creating))
          }}
        >
          <fieldset disabled={pending} className='space-y-4'>
            <FieldInput
              field={{
                name: 'name',
                label: 'Name',
                required: true,
                maxLength: 100,
              }}
              value={current?.name}
            />
            <FieldInput
              field={{
                name: 'description',
                label: 'Description',
                maxLength: 250,
              }}
              value={current?.description}
            />
            <FieldInput
              field={{
                name: 'parentId',
                label: parent
                  ? `Parent (${parent.pathstring})`
                  : 'Parent location ID (blank = top level)',
                type: 'number',
                min: 1,
                max: 2147483647,
              }}
              value={parentId === '' ? '' : String(parentId)}
              disabled={parent !== null}
            />
            <div className='space-y-2'>
              <Label htmlFor='location-type'>Location type</Label>
              <select
                id='location-type'
                name='locationTypeId'
                defaultValue={current?.locationTypeId ?? ''}
                className='flex h-9 w-full rounded-md border bg-transparent px-3 text-sm'
              >
                <option value=''>None</option>
                {types.data?.items.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <FieldInput
              field={{
                name: 'ownerId',
                label: 'Owner ID',
                type: 'number',
                min: 1,
                max: 2147483647,
              }}
              value={current?.ownerId == null ? '' : String(current.ownerId)}
            />
            <FieldInput
              field={{
                name: 'customIcon',
                label: 'Custom icon',
                maxLength: 100,
              }}
              value={current?.customIcon ?? ''}
            />
            <FieldInput
              field={{
                name: 'barcodeData',
                label: 'Barcode',
                maxLength: 500,
              }}
              value={current?.barcodeData}
            />
            <FieldInput
              field={{
                name: 'metadata',
                label: 'Metadata (JSON object, optional)',
                type: 'textarea',
              }}
              value={
                current?.metadata
                  ? JSON.stringify(current.metadata, null, 2)
                  : ''
              }
            />
            <FlagInput
              name='structural'
              label='Structural (organizes the tree, not a stock bin)'
              defaultChecked={current?.structural ?? false}
            />
            <FlagInput
              name='external'
              label='External (not available for immediate use)'
              defaultChecked={current?.external ?? false}
            />
            <Button disabled={pending}>Save</Button>
          </fieldset>
          {error != null && (
            <p role='alert' className='text-destructive'>
              {errorMessage(error)}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LocationBranch({
  parentId,
  search,
  depth,
  expanded,
  selectedId,
  canChange,
  canDelete,
  onToggle,
  onSelect,
  onEdit,
  onCreateChild,
  onDelete,
}: {
  parentId: number | null
  search: string
  depth: number
  expanded: ReadonlySet<number>
  selectedId: number | null
  canChange: boolean
  canDelete: boolean
  onToggle: (id: number) => void
  onSelect: (location: Location) => void
  onEdit: (location: Location) => void
  onCreateChild: (location: Location) => void
  onDelete: (location: Location) => void
}) {
  const searching = parentId == null && search.length > 0
  const rows = useQuery({
    queryKey: ['stock', 'locations', parentId ?? 'roots', search],
    queryFn: () =>
      stockApi.locations({
        search: parentId == null ? search : undefined,
        roots: parentId == null && !search,
        parentId: parentId ?? undefined,
      }),
  })
  if (rows.isPending) return <p role='status'>Loading locations…</p>
  if (rows.isError)
    return (
      <div role='alert'>
        {errorMessage(rows.error)}{' '}
        <Button variant='outline' onClick={() => void rows.refetch()}>
          Retry
        </Button>
      </div>
    )
  return (
    <ul className='space-y-2'>
      {rows.data.items.map((location) => {
        const open = expanded.has(location.id)
        return (
          <li key={location.id} style={{ marginLeft: depth * 16 }}>
            <div
              className={`rounded-md border p-3 ${selectedId === location.id ? 'border-primary' : ''}`}
            >
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <button
                  type='button'
                  className='text-left'
                  onClick={() => onSelect(location)}
                >
                  <span className='font-medium'>{location.name}</span>
                  <span className='mt-1 block text-sm text-muted-foreground'>
                    {location.pathstring}
                    {location.locationType
                      ? ` · ${location.locationType.name}`
                      : ''}
                    {location.ownerId != null
                      ? ` · Owner ${location.ownerId}`
                      : ' · No owner'}
                    {location.structural ? ' · Structural' : ''}
                    {location.external ? ' · External' : ''}
                  </span>
                </button>
                <div className='flex flex-wrap gap-2'>
                  {!searching && location.childCount > 0 && (
                    <Button
                      variant='outline'
                      aria-expanded={open}
                      onClick={() => onToggle(location.id)}
                    >
                      {open ? 'Hide' : `Children (${location.childCount})`}
                    </Button>
                  )}
                  {canChange && (
                    <>
                      <Button
                        variant='outline'
                        aria-label={`Edit ${location.name}`}
                        onClick={() => onEdit(location)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant='outline'
                        onClick={() => onCreateChild(location)}
                      >
                        Add child
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button
                      variant='outline'
                      aria-label={`Delete ${location.name}`}
                      onClick={() => onDelete(location)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {open && !searching && (
              <div className='mt-2'>
                <LocationBranch
                  parentId={location.id}
                  search=''
                  depth={depth + 1}
                  expanded={expanded}
                  selectedId={selectedId}
                  canChange={canChange}
                  canDelete={canDelete}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onCreateChild={onCreateChild}
                  onDelete={onDelete}
                />
              </div>
            )}
          </li>
        )
      })}
      {!rows.data.items.length && (
        <li className='text-sm text-muted-foreground'>No locations.</li>
      )}
      {rows.data.total > rows.data.items.length && (
        <li className='text-sm text-muted-foreground'>
          Showing {rows.data.items.length} of {rows.data.total}. Refine the
          search to reach the rest.
        </li>
      )}
    </ul>
  )
}

export function LocationsPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const [selected, setSelected] = useState<Location | null>(null)
  const [editing, setEditing] = useState<Location | 'new' | null>(null)
  const [parent, setParent] = useState<Location | null>(null)
  const [deleting, setDeleting] = useState<Location | null>(null)
  const canAdd = hasPermission(effective, 'stock_location', 'add')
  const canChange = hasPermission(effective, 'stock_location', 'change')
  const canDelete = hasPermission(effective, 'stock_location', 'delete')
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['stock', 'locations'] })
  }
  const save = useMutation({
    mutationFn: ({ body, id }: { body: LocationInput; id?: number }) =>
      stockApi.saveLocation(body, id),
    onSuccess: async (location) => {
      setEditing(null)
      setParent(null)
      setSelected(location)
      await invalidate()
      toast.success('Location saved.')
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => stockApi.removeLocation(id),
    onSuccess: async () => {
      setDeleting(null)
      setSelected(null)
      await invalidate()
      toast.success('Location deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Location tree</h2>
          <p className='text-sm text-muted-foreground'>
            Top-level locations are warehouses or sites. Open children to see
            the path underneath. Unowned locations are visible to everyone with
            stock location view permission.
          </p>
        </div>
        {canAdd && (
          <Button
            onClick={() => {
              save.reset()
              setParent(null)
              setEditing('new')
            }}
          >
            Create top-level location
          </Button>
        )}
      </div>
      <Input
        aria-label='Search locations'
        placeholder='Search name, description, or path…'
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        maxLength={100}
        className='max-w-sm'
      />
      <LocationBranch
        parentId={null}
        search={search}
        depth={0}
        expanded={expanded}
        selectedId={selected?.id ?? null}
        canChange={canChange}
        canDelete={canDelete}
        onToggle={(id) =>
          setExpanded((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }
        onSelect={setSelected}
        onEdit={(location) => {
          save.reset()
          setParent(null)
          setEditing(location)
        }}
        onCreateChild={(location) => {
          save.reset()
          setParent(location)
          setEditing('new')
        }}
        onDelete={setDeleting}
      />
      {selected && (
        <p className='text-sm text-muted-foreground'>
          Selected {selected.pathstring}.{' '}
          {selected.childCount
            ? 'Delete is refused while child locations exist.'
            : 'This location has no children.'}
        </p>
      )}
      {editing !== null && (
        <LocationForm
          location={editing}
          parent={parent}
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            setEditing(null)
            setParent(null)
          }}
          onSubmit={(body) =>
            save.mutate({
              body,
              id: editing === 'new' ? undefined : editing.id,
            })
          }
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
        title='Delete location'
        desc={`Delete ${deleting?.name ?? 'this location'}? Child locations must be moved or deleted first.`}
        destructive
        confirmText='Delete'
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (deleting) remove.mutate(deleting.id)
        }}
      />
    </section>
  )
}
