import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { FlagInput } from '@/components/flag-input'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, supplierApi } from '../api'
import { formatSupplierAddress } from '../format'
import type { Supplier, SupplierInput } from '../model'
import { SupplierForm } from './supplier-form'

export function SupplierDirectory() {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const suppliers = useQuery({
    queryKey: [
      'supplier',
      organizationCacheScope(),
      'list',
      page,
      search,
      activeOnly,
    ],
    queryFn: () =>
      supplierApi.list(page, search, activeOnly ? true : undefined),
  })
  const creation = useMutation({
    mutationFn: (input: { body: SupplierInput; scope: string }) =>
      supplierApi.save(input.body),
    onSuccess: async (_saved, input) => {
      await client.invalidateQueries({
        queryKey: ['supplier', input.scope],
      })
      setCreating(false)
      toast.success('Supplier created.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const columns = useMemo<SortableColumn<Supplier>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (supplier) => supplier.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'contact',
        header: 'Contact',
        accessorFn: (supplier) =>
          [supplier.contact, supplier.contactPhone, supplier.contactRole]
            .filter((value) => value.trim() !== '')
            .join(' · ') || '—',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'address',
        header: 'Address',
        accessorFn: (supplier) => formatSupplierAddress(supplier) || '—',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'active',
        header: 'Active',
        accessorFn: (supplier) => (supplier.active ? 'Yes' : 'No'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to='/o/$organizationSlug/supplier/$supplierId'
            params={{
              organizationSlug,
              supplierId: row.original.uuid,
            }}
            aria-label={`Details for ${row.original.name}`}
            className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Details
          </Link>
        ),
      },
    ],
    [organizationSlug]
  )
  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button type='button' onClick={() => setCreating(true)}>
          Create supplier
        </Button>
      </div>
      <div className='flex flex-wrap items-end gap-3'>
        <Input
          aria-label='Search suppliers'
          placeholder='Search suppliers…'
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
      {suppliers.isPending && <p role='status'>Loading suppliers…</p>}
      {suppliers.isError && (
        <p role='alert'>
          {errorMessage(suppliers.error)}{' '}
          <Button variant='outline' onClick={() => void suppliers.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {suppliers.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {suppliers.data.total} suppliers. Sorting applies to this page only.
          </p>
          <SortableDataTable
            data={suppliers.data.items}
            columns={columns}
            getRowId={(supplier) => supplier.uuid}
            caption='Suppliers'
            emptyMessage='No suppliers match this search.'
          />
        </>
      )}
      <PageControls
        page={page}
        loading={suppliers.isFetching}
        hasNext={
          !!suppliers.data &&
          (page + 1) * suppliers.data.limit < suppliers.data.total
        }
        onChange={setPage}
      />
      {creating && (
        <SupplierForm
          supplier='new'
          pending={creation.isPending}
          error={creation.error}
          onClose={() => setCreating(false)}
          onSubmit={async (body, scope) => {
            await creation.mutateAsync({ body, scope })
          }}
        />
      )}
    </div>
  )
}
