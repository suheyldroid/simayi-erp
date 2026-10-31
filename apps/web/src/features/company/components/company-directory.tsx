import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { companyApi, errorMessage } from '../api'
import {
  canCompany,
  type Company,
  type CompanyFilter,
  type CompanyInput,
} from '../model'
import { AddressesPanel } from './addresses-panel'
import { CompanyForm } from './company-form'
import { ContactsPanel } from './contacts-panel'
import { FlagInput } from './flag-input'
import { ManufacturerPartsPanel } from './manufacturer-parts-panel'
import { SupplierPartsPanel } from './supplier-parts-panel'

function roles(company: Company) {
  return [
    company.isCustomer ? 'Customer' : null,
    company.isSupplier ? 'Supplier' : null,
    company.isManufacturer ? 'Manufacturer' : null,
  ]
    .filter((value): value is string => value !== null)
    .join(', ')
}

export function CompanyDirectory({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const client = useQueryClient()
  const [filter, setFilter] = useState<CompanyFilter>('all')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Company | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const canCreate =
    hasPermission(effective, 'purchase_order', 'add') ||
    hasPermission(effective, 'sales_order', 'add')
  const rows = useQuery({
    queryKey: ['company', 'list', filter, page, search, activeOnly],
    queryFn: () =>
      companyApi.list(page, search, filter, activeOnly ? true : undefined),
  })
  const selected =
    rows.data?.items.find((company) => company.id === selectedId) ?? null
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['company'] })
  }
  const save = useMutation({
    mutationFn: ({ body, id }: { body: CompanyInput; id?: number }) =>
      companyApi.save(body, id),
    onSuccess: async (company) => {
      setEditing(null)
      setSelectedId(company.id)
      await invalidate()
      toast.success('Company saved.')
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => companyApi.remove(id),
    onSuccess: async () => {
      setDeleting(null)
      setSelectedId(null)
      setPage(0)
      await invalidate()
      toast.success('Company deleted.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const canChangeSelected = selected
    ? canCompany(effective, selected, 'change')
    : false
  const canDeleteSelected = selected
    ? canCompany(effective, selected, 'delete')
    : false
  return (
    <div className='space-y-6'>
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as CompanyFilter)
          setPage(0)
        }}
      >
        <TabsList className='h-auto flex-wrap'>
          <TabsTrigger value='all'>All</TabsTrigger>
          <TabsTrigger value='customers'>Customers</TabsTrigger>
          <TabsTrigger value='suppliers'>Suppliers</TabsTrigger>
          <TabsTrigger value='manufacturers'>Manufacturers</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='flex flex-wrap items-end gap-3'>
          <Input
            aria-label='Search companies'
            placeholder='Search companies…'
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            maxLength={100}
            className='max-w-sm'
          />
          <FlagInput
            name='activeOnly'
            label='Active only'
            checked={activeOnly}
            onChange={(value) => {
              setActiveOnly(value)
              setPage(0)
            }}
          />
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              save.reset()
              setEditing('new')
            }}
          >
            Create company
          </Button>
        )}
      </div>
      {rows.isPending && <p role='status'>Loading companies…</p>}
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
              <TableHead>Roles</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((company) => (
              <TableRow
                key={company.id}
                data-state={company.id === selectedId ? 'selected' : undefined}
                className='cursor-pointer'
                onClick={() => setSelectedId(company.id)}
              >
                <TableCell>{company.name}</TableCell>
                <TableCell>{roles(company)}</TableCell>
                <TableCell>{company.active ? 'Yes' : 'No'}</TableCell>
                <TableCell>{company.currency}</TableCell>
                <TableCell>{company.email ?? '—'}</TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    {canCompany(effective, company, 'change') && (
                      <Button
                        variant='outline'
                        aria-label={`Edit ${company.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          save.reset()
                          setSelectedId(company.id)
                          setEditing(company)
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {canCompany(effective, company, 'delete') && (
                      <Button
                        variant='outline'
                        aria-label={`Delete ${company.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleting(company)
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!rows.data.items.length && (
              <TableRow>
                <TableCell colSpan={6}>No companies.</TableCell>
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
      {selected && (
        <section className='space-y-6 rounded-md border p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h2 className='text-xl font-semibold'>{selected.name}</h2>
              <p className='text-sm text-muted-foreground'>
                {selected.description}
              </p>
              <p className='text-sm text-muted-foreground'>
                {roles(selected)} · {selected.currency}
                {selected.taxId ? ` · Tax ID ${selected.taxId}` : ''}
              </p>
            </div>
            <div className='flex gap-2'>
              {canChangeSelected && (
                <Button
                  variant='outline'
                  onClick={() => {
                    save.reset()
                    setEditing(selected)
                  }}
                >
                  Edit
                </Button>
              )}
              {canDeleteSelected && (
                <Button variant='outline' onClick={() => setDeleting(selected)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
          <ContactsPanel company={selected} canChange={canChangeSelected} />
          <AddressesPanel company={selected} canChange={canChangeSelected} />
          {hasPermission(effective, 'purchase_order', 'view') &&
            selected.isManufacturer && (
              <ManufacturerPartsPanel
                manufacturerId={selected.id}
                canAdd={hasPermission(effective, 'purchase_order', 'add')}
                canChange={hasPermission(effective, 'purchase_order', 'change')}
                canDelete={hasPermission(effective, 'purchase_order', 'delete')}
              />
            )}
          {hasPermission(effective, 'purchase_order', 'view') &&
            selected.isSupplier && (
              <SupplierPartsPanel
                supplierId={selected.id}
                canAdd={hasPermission(effective, 'purchase_order', 'add')}
                canChange={hasPermission(effective, 'purchase_order', 'change')}
                canDelete={hasPermission(effective, 'purchase_order', 'delete')}
              />
            )}
        </section>
      )}
      {editing !== null && (
        <CompanyForm
          company={editing}
          effective={effective}
          pending={save.isPending}
          error={save.error}
          onClose={() => setEditing(null)}
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
        title='Delete company'
        desc={`Permanently delete ${deleting?.name ?? 'this company'}, its contacts, addresses, and part links? This cannot be undone.`}
        destructive
        confirmText='Delete'
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (deleting) remove.mutate(deleting.id)
        }}
      />
    </div>
  )
}
