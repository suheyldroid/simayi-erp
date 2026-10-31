import { useState, type ReactNode } from 'react'
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
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage } from '../api'
import { FieldInput, type FieldDefinition } from './field-input'

type Page<Row> = { items: Row[]; total: number; limit: number; offset: number }
type ResourceField<Row> = FieldDefinition & {
  name: keyof Row & string
  value?: (row: Row) => string | boolean
}

export function ResourcePanel<Row extends { id: number }, Body>({
  resource,
  title,
  description,
  effective,
  fields = [],
  headers,
  cells,
  list,
  parse,
  save,
  remove,
}: {
  resource: string
  title: string
  description: string
  effective: EffectivePermissions
  fields?: ResourceField<Row>[]
  headers: string[]
  cells: (row: Row) => ReactNode[]
  list: (page: number, search: string) => Promise<Page<Row>>
  parse?: (form: FormData) => Body
  save?: (body: Body, id?: number) => Promise<unknown>
  remove?: (id: number) => Promise<unknown>
}) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const rows = useQuery({
    queryKey: ['common', resource, page, search],
    queryFn: () => list(page, search),
  })
  const mutation = useMutation({
    mutationFn: async ({ form, id }: { form: FormData; id?: number }) => {
      if (!save || !parse) throw new Error('Read-only resource')
      return save(parse(form), id)
    },
    onSuccess: async () => {
      setEditing(null)
      await client.invalidateQueries({ queryKey: ['common', resource] })
      toast.success('Saved.')
    },
  })
  const deletion = useMutation({
    mutationFn: async (id: number) => {
      if (!remove) throw new Error('Read-only resource')
      return remove(id)
    },
    onSuccess: async () => {
      setDeleting(null)
      setPage(0)
      await client.invalidateQueries({ queryKey: ['common', resource] })
      toast.success('Deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const canCreate = !!save && hasPermission(effective, 'admin', 'add')
  const canEdit = !!save && hasPermission(effective, 'admin', 'change')
  const canDelete = !!remove && hasPermission(effective, 'admin', 'delete')
  const editor = editing !== null && (editing === 'new' ? canCreate : canEdit)
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>{title}</h2>
          <p className='text-sm text-muted-foreground'>{description}</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              mutation.reset()
              setEditing('new')
            }}
          >
            Create
          </Button>
        )}
      </div>
      <Input
        aria-label={`Search ${title}`}
        placeholder='Search…'
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        maxLength={100}
        className='max-w-sm'
      />
      {rows.isPending && <p role='status'>Loading…</p>}
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
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
              {(canEdit || canDelete) && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((row) => (
              <TableRow key={row.id}>
                {cells(row).map((cell, index) => (
                  <TableCell key={headers[index]}>{cell}</TableCell>
                ))}
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className='flex gap-2'>
                      {canEdit && (
                        <Button
                          variant='outline'
                          aria-label={`Edit ${title} #${row.id}`}
                          onClick={() => {
                            mutation.reset()
                            setEditing(row)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant='outline'
                          aria-label={`Delete ${title} #${row.id}`}
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
                <TableCell
                  colSpan={headers.length + (canEdit || canDelete ? 1 : 0)}
                >
                  No records.
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
        open={editor}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEditing(null)
        }}
      >
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'Create' : 'Edit'} {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form
              key={editing === 'new' ? 'new' : editing.id}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate({
                  form: new FormData(event.currentTarget),
                  id: editing === 'new' ? undefined : editing.id,
                })
              }}
            >
              <fieldset disabled={mutation.isPending} className='space-y-4'>
                {fields.map((field) => {
                  const value =
                    editing === 'new'
                      ? field.defaultValue
                      : field.value
                        ? field.value(editing)
                        : editing[field.name]
                  return (
                    <FieldInput
                      key={field.name}
                      field={field}
                      value={
                        typeof value === 'boolean'
                          ? value
                          : value == null
                            ? ''
                            : String(value)
                      }
                      disabled={editing !== 'new' && field.immutable}
                    />
                  )
                })}
                <Button disabled={mutation.isPending}>Save</Button>
              </fieldset>
              {mutation.isError && (
                <p role='alert' className='text-destructive'>
                  {errorMessage(mutation.error)}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null && canDelete}
        onOpenChange={(open) => {
          if (!open && !deletion.isPending) setDeleting(null)
        }}
        title={`Delete ${title}`}
        desc={`Permanently delete record #${deleting?.id ?? ''}? This cannot be undone.`}
        destructive
        confirmText='Delete'
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (deleting) deletion.mutate(deleting.id)
        }}
      />
    </section>
  )
}
