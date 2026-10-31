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
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, stockApi } from '../api'
import { StockModel, type LocationType, type LocationTypeInput } from '../model'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function parseType(form: FormData): LocationTypeInput {
  try {
    const metadata = text(form, 'metadata').trim()
    return StockModel.typeBody.parse({
      name: text(form, 'name'),
      description: text(form, 'description'),
      icon: text(form, 'icon'),
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

export function LocationTypesPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<LocationType | 'new' | null>(null)
  const [deleting, setDeleting] = useState<LocationType | null>(null)
  const canAdd = hasPermission(effective, 'stock_location', 'add')
  const canChange = hasPermission(effective, 'stock_location', 'change')
  const canDelete = hasPermission(effective, 'stock_location', 'delete')
  const rows = useQuery({
    queryKey: ['stock', 'location-types', page, search],
    queryFn: () => stockApi.locationTypes(page, search),
  })
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['stock', 'location-types'] })
  }
  const save = useMutation({
    mutationFn: ({ body, id }: { body: LocationTypeInput; id?: number }) =>
      stockApi.saveLocationType(body, id),
    onSuccess: async () => {
      setEditing(null)
      await invalidate()
      toast.success('Location type saved.')
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => stockApi.removeLocationType(id),
    onSuccess: async () => {
      setDeleting(null)
      setPage(0)
      await invalidate()
      toast.success('Location type deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const current = editing === 'new' || editing === null ? undefined : editing
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Location types</h2>
          <p className='text-sm text-muted-foreground'>
            Shared labels such as warehouse, room, shelf, or drawer. Icon text
            uses a pack prefix, for example ti:bookmark:outline.
          </p>
        </div>
        {canAdd && (
          <Button
            onClick={() => {
              save.reset()
              setEditing('new')
            }}
          >
            Create type
          </Button>
        )}
      </div>
      <Input
        aria-label='Search location types'
        placeholder='Search types…'
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        maxLength={100}
        className='max-w-sm'
      />
      {rows.isPending && <p role='status'>Loading location types…</p>}
      {rows.isError && (
        <div role='alert'>
          {errorMessage(rows.error)}{' '}
          <Button variant='outline' onClick={() => void rows.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {rows.data && !rows.isError && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Icon</TableHead>
              {(canChange || canDelete) && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.description || '—'}</TableCell>
                <TableCell>{row.icon || '—'}</TableCell>
                {(canChange || canDelete) && (
                  <TableCell>
                    <div className='flex gap-2'>
                      {canChange && (
                        <Button
                          variant='outline'
                          aria-label={`Edit ${row.name}`}
                          onClick={() => {
                            save.reset()
                            setEditing(row)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant='outline'
                          aria-label={`Delete ${row.name}`}
                          onClick={() => setDeleting(row)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!rows.data.items.length && (
              <TableRow>
                <TableCell colSpan={canChange || canDelete ? 4 : 3}>
                  No location types.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <PageControls
        page={page}
        loading={rows.isFetching}
        hasNext={
          !!rows.data && rows.data.offset + rows.data.limit < rows.data.total
        }
        onChange={setPage}
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditing(null)
        }}
      >
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editing === 'new'
                ? 'Create location type'
                : 'Edit location type'}
            </DialogTitle>
            <DialogDescription>
              Deleting a type clears it from locations. The locations remain.
            </DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <form
              key={editing === 'new' ? 'new' : editing.id}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                save.mutate({
                  body: parseType(new FormData(event.currentTarget)),
                  id: editing === 'new' ? undefined : editing.id,
                })
              }}
            >
              <fieldset disabled={save.isPending} className='space-y-4'>
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
                  field={{ name: 'icon', label: 'Icon', maxLength: 100 }}
                  value={current?.icon}
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
                <Button disabled={save.isPending}>Save</Button>
              </fieldset>
              {save.isError && (
                <p role='alert' className='text-destructive'>
                  {errorMessage(save.error)}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null && canDelete}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
        title='Delete location type'
        desc={`Delete ${deleting?.name ?? 'this type'}? Locations that use it keep their place in the tree and lose this type.`}
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
