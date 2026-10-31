import { useState } from 'react'
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
  type Address,
  type AddressInput,
  type Company,
} from '../model'
import { FlagInput } from './flag-input'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function parseAddress(form: FormData): AddressInput {
  return CompanyModel.addressBody.parse({
    title: text(form, 'title'),
    primary: form.has('primary'),
    line1: text(form, 'line1'),
    line2: text(form, 'line2'),
    postalCode: text(form, 'postalCode'),
    postalCity: text(form, 'postalCity'),
    province: text(form, 'province'),
    country: text(form, 'country'),
    shippingNotes: text(form, 'shippingNotes'),
    internalShippingNotes: text(form, 'internalShippingNotes'),
    link: text(form, 'link'),
  })
}

export function AddressesPanel({
  company,
  canChange,
}: {
  company: Company
  canChange: boolean
}) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Address | null>(null)
  const rows = useQuery({
    queryKey: ['company', company.id, 'addresses', page, search],
    queryFn: () => companyApi.addresses(company.id, page, search),
  })
  const invalidate = async () => {
    await client.invalidateQueries({
      queryKey: ['company', company.id, 'addresses'],
    })
  }
  const save = useMutation({
    mutationFn: ({ body, id }: { body: AddressInput; id?: number }) =>
      companyApi.saveAddress(company.id, body, id),
    onSuccess: async () => {
      setEditing(null)
      await invalidate()
      toast.success('Address saved.')
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => companyApi.removeAddress(company.id, id),
    onSuccess: async () => {
      setDeleting(null)
      setPage(0)
      await invalidate()
      toast.success('Address deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const current = editing === 'new' || editing === null ? undefined : editing
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-lg font-semibold'>Addresses</h3>
          <p className='text-sm text-muted-foreground'>
            A company can have one primary address. Marking a new primary
            address replaces the previous one.
          </p>
        </div>
        {canChange && (
          <Button
            onClick={() => {
              save.reset()
              setEditing('new')
            }}
          >
            Add address
          </Button>
        )}
      </div>
      <Input
        aria-label='Search addresses'
        placeholder='Search addresses…'
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        maxLength={100}
        className='max-w-sm'
      />
      {rows.isPending && <p role='status'>Loading addresses…</p>}
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
              <TableHead>Title</TableHead>
              <TableHead>Primary</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              {canChange && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.primary ? 'Yes' : 'No'}</TableCell>
                <TableCell>{row.postalCity || '—'}</TableCell>
                <TableCell>{row.country || '—'}</TableCell>
                {canChange && (
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        aria-label={`Edit address ${row.title}`}
                        onClick={() => {
                          save.reset()
                          setEditing(row)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant='outline'
                        aria-label={`Delete address ${row.title}`}
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
                <TableCell colSpan={canChange ? 5 : 4}>No addresses.</TableCell>
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
              {editing === 'new' ? 'Add address' : 'Edit address'}
            </DialogTitle>
            <DialogDescription>
              International address components for orders and shipping.
            </DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <form
              key={editing === 'new' ? 'new' : editing.id}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                save.mutate({
                  body: parseAddress(new FormData(event.currentTarget)),
                  id: editing === 'new' ? undefined : editing.id,
                })
              }}
            >
              <fieldset disabled={save.isPending} className='space-y-4'>
                <FieldInput
                  field={{
                    name: 'title',
                    label: 'Title',
                    required: true,
                    maxLength: 100,
                  }}
                  value={current?.title}
                />
                <FieldInput
                  field={{ name: 'line1', label: 'Line 1', maxLength: 50 }}
                  value={current?.line1}
                />
                <FieldInput
                  field={{ name: 'line2', label: 'Line 2', maxLength: 50 }}
                  value={current?.line2}
                />
                <FieldInput
                  field={{
                    name: 'postalCode',
                    label: 'Postal code',
                    maxLength: 10,
                  }}
                  value={current?.postalCode}
                />
                <FieldInput
                  field={{ name: 'postalCity', label: 'City', maxLength: 50 }}
                  value={current?.postalCity}
                />
                <FieldInput
                  field={{ name: 'province', label: 'Province', maxLength: 50 }}
                  value={current?.province}
                />
                <FieldInput
                  field={{ name: 'country', label: 'Country', maxLength: 50 }}
                  value={current?.country}
                />
                <FieldInput
                  field={{
                    name: 'shippingNotes',
                    label: 'Shipping notes',
                    maxLength: 100,
                  }}
                  value={current?.shippingNotes}
                />
                <FieldInput
                  field={{
                    name: 'internalShippingNotes',
                    label: 'Internal shipping notes',
                    maxLength: 100,
                  }}
                  value={current?.internalShippingNotes}
                />
                <FieldInput
                  field={{ name: 'link', label: 'Link', maxLength: 2000 }}
                  value={current?.link}
                />
                <FlagInput
                  name='primary'
                  label='Primary address'
                  defaultChecked={current?.primary ?? false}
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
        title='Delete address'
        desc={`Permanently delete ${deleting?.title ?? 'this address'}? This cannot be undone.`}
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
