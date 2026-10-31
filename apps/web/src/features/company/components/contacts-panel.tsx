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
import { PageControls } from '@/features/users/components/page-controls'
import { companyApi, errorMessage } from '../api'
import {
  CompanyModel,
  type Company,
  type Contact,
  type ContactInput,
} from '../model'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function parseContact(form: FormData): ContactInput {
  try {
    const metadata = text(form, 'metadata').trim()
    return CompanyModel.contactBody.parse({
      name: text(form, 'name'),
      phone: text(form, 'phone'),
      email: text(form, 'email'),
      role: text(form, 'role'),
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

export function ContactsPanel({
  company,
  canChange,
}: {
  company: Company
  canChange: boolean
}) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Contact | null>(null)
  const rows = useQuery({
    queryKey: ['company', company.id, 'contacts', page, search],
    queryFn: () => companyApi.contacts(company.id, page, search),
  })
  const invalidate = async () => {
    await client.invalidateQueries({
      queryKey: ['company', company.id, 'contacts'],
    })
  }
  const save = useMutation({
    mutationFn: ({ body, id }: { body: ContactInput; id?: number }) =>
      companyApi.saveContact(company.id, body, id),
    onSuccess: async () => {
      setEditing(null)
      await invalidate()
      toast.success('Contact saved.')
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => companyApi.removeContact(company.id, id),
    onSuccess: async () => {
      setDeleting(null)
      setPage(0)
      await invalidate()
      toast.success('Contact deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const current = editing === 'new' || editing === null ? undefined : editing
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-lg font-semibold'>Contacts</h3>
          <p className='text-sm text-muted-foreground'>
            People associated with {company.name}.
          </p>
        </div>
        {canChange && (
          <Button
            onClick={() => {
              save.reset()
              setEditing('new')
            }}
          >
            Add contact
          </Button>
        )}
      </div>
      <Input
        aria-label='Search contacts'
        placeholder='Search contacts…'
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        maxLength={100}
        className='max-w-sm'
      />
      {rows.isPending && <p role='status'>Loading contacts…</p>}
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
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              {canChange && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.role || '—'}</TableCell>
                <TableCell>{row.email || '—'}</TableCell>
                <TableCell>{row.phone || '—'}</TableCell>
                {canChange && (
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        aria-label={`Edit contact ${row.name}`}
                        onClick={() => {
                          save.reset()
                          setEditing(row)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant='outline'
                        aria-label={`Delete contact ${row.name}`}
                        onClick={() => setDeleting(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!rows.data.items.length && (
              <TableRow>
                <TableCell colSpan={canChange ? 5 : 4}>No contacts.</TableCell>
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
        open={editing !== null && canChange}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditing(null)
        }}
      >
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'Add contact' : 'Edit contact'}
            </DialogTitle>
            <DialogDescription>
              Name, role, and communication details for this company.
            </DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <form
              key={editing === 'new' ? 'new' : editing.id}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                save.mutate({
                  body: parseContact(new FormData(event.currentTarget)),
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
                  field={{ name: 'role', label: 'Role', maxLength: 100 }}
                  value={current?.role}
                />
                <FieldInput
                  field={{ name: 'email', label: 'Email', maxLength: 254 }}
                  value={current?.email}
                />
                <FieldInput
                  field={{ name: 'phone', label: 'Phone', maxLength: 100 }}
                  value={current?.phone}
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
        open={deleting !== null && canChange}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
        title='Delete contact'
        desc={`Permanently delete ${deleting?.name ?? 'this contact'}? This cannot be undone.`}
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
