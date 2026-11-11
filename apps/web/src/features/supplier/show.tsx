import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { imageUrl } from '@/lib/image-url'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { OrdersDirectory } from '@/features/purchasing/components/orders-directory'
import { errorMessage, supplierApi } from './api'
import { SupplierForm } from './components/supplier-form'
import { formatSupplierAddress } from './format'
import { supplierImagePrefix } from './image-api'
import type { Supplier, SupplierInput } from './model'

const supplierRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/supplier/$supplierId'
)

export function SupplierDetail() {
  const { supplierId } = supplierRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const uuid = parseResourceUuid(supplierId)
  const client = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const details = useQuery({
    queryKey: ['supplier', organizationCacheScope(), 'detail', uuid],
    queryFn: () => supplierApi.get(uuid as string),
    enabled: uuid !== null,
    refetchOnWindowFocus: false,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const supplier = details.data
  const eligibleRead =
    details.isSuccess &&
    supplier != null &&
    uuid !== null &&
    supplier.uuid === uuid
  const editingEligible =
    eligibleRead && editing != null && editing.uuid === uuid
  const deletingEligible =
    eligibleRead && deleting != null && deleting.uuid === uuid
  const save = useMutation({
    mutationFn: (input: { body: SupplierInput; uuid: string; scope: string }) =>
      supplierApi.save(input.body, input.uuid),
    onSuccess: async (saved, input) => {
      client.setQueryData(
        ['supplier', input.scope, 'detail', saved.uuid],
        saved
      )
      setEditing(null)
      await client.invalidateQueries({
        queryKey: ['supplier', input.scope],
      })
      toast.success('Supplier saved.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (target: Supplier) => supplierApi.remove(target.uuid),
    onSuccess: async () => {
      setDeleting(null)
      await client.invalidateQueries({ queryKey: ['supplier'] })
      toast.success('Supplier deleted.')
      await navigate({
        to: '/o/$organizationSlug/supplier',
        params: { organizationSlug },
      })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/supplier'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to suppliers
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>Supplier details</h1>
        </div>
        {uuid === null && <p role='alert'>Supplier not found.</p>}
        {uuid !== null && details.isPending && (
          <p role='status'>Loading supplier…</p>
        )}
        {details.isError && detailStatus === 404 && (
          <p role='alert'>Supplier not found.</p>
        )}
        {details.isError && detailStatus !== 404 && (
          <p role='alert'>
            Could not load this supplier.{' '}
            <Button variant='outline' onClick={() => void details.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {eligibleRead && supplier ? (
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='flex items-start gap-4'>
                {supplier.image ? (
                  failedImage === supplier.image ? (
                    <span className='flex size-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted px-2 text-center text-xs text-muted-foreground'>
                      Image unavailable
                    </span>
                  ) : (
                    <img
                      src={imageUrl(supplier.image)}
                      alt={`${supplier.name} image`}
                      className='size-24 shrink-0 rounded-md border border-border bg-muted object-contain'
                      crossOrigin={
                        supplier.image.startsWith(supplierImagePrefix)
                          ? 'use-credentials'
                          : undefined
                      }
                      onError={() => setFailedImage(supplier.image)}
                    />
                  )
                ) : null}
                <div>
                  <h2 className='text-xl font-semibold'>{supplier.name}</h2>
                  <p className='text-sm text-muted-foreground'>
                    {supplier.description}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {supplier.active ? 'Active' : 'Inactive'}
                    {supplier.taxId ? ` · Tax ID ${supplier.taxId}` : ''}
                  </p>
                </div>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button variant='outline' onClick={() => setEditing(supplier)}>
                  Edit
                </Button>
                <Button variant='outline' onClick={() => setDeleting(supplier)}>
                  Delete
                </Button>
              </div>
            </div>
            <dl className='grid gap-4 text-sm sm:grid-cols-2'>
              <div className='space-y-1'>
                <dt className='font-medium'>Contact</dt>
                <dd>{supplier.contact || '—'}</dd>
                <dd>{supplier.contactPhone || '—'}</dd>
                <dd>{supplier.contactRole || '—'}</dd>
              </div>
              <div className='space-y-1'>
                <dt className='font-medium'>Address</dt>
                <dd>{formatSupplierAddress(supplier) || '—'}</dd>
                <dd>Shipping notes: {supplier.shippingNotes || '—'}</dd>
                <dd>
                  Internal shipping notes:{' '}
                  {supplier.internalShippingNotes || '—'}
                </dd>
                <dd>Address link: {supplier.addressLink || '—'}</dd>
              </div>
              <div className='space-y-1'>
                <dt className='font-medium'>Phone</dt>
                <dd>{supplier.phone || '—'}</dd>
                <dt className='font-medium'>Tax ID</dt>
                <dd>{supplier.taxId || '—'}</dd>
              </div>
            </dl>
          </section>
        ) : null}
        {eligibleRead && supplier ? (
          <section
            aria-labelledby='supplier-purchase-orders'
            className='space-y-4 rounded-md border border-border p-4'
          >
            <div>
              <h2
                id='supplier-purchase-orders'
                className='text-xl font-semibold'
              >
                Purchase orders
              </h2>
              <p className='text-sm text-muted-foreground'>
                Purchase orders recorded for this supplier. Open an order to
                manage its lines, extras, status, and receipts.
              </p>
            </div>
            <OrdersDirectory
              key={`${organizationSlug}:${supplier.uuid}`}
              supplier={{
                uuid: supplier.uuid,
                name: supplier.name,
                contact: supplier.contact,
              }}
              emptyMessage='No purchase orders for this supplier yet.'
            />
          </section>
        ) : null}
        {editingEligible && editing ? (
          <SupplierForm
            supplier={editing}
            pending={save.isPending}
            error={save.error}
            onClose={() => setEditing(null)}
            onSubmit={async (body, scope) => {
              if (!eligibleRead || editing.uuid !== uuid) return
              await save.mutateAsync({ body, uuid: editing.uuid, scope })
            }}
          />
        ) : null}
        {deletingEligible && deleting ? (
          <ConfirmDialog
            open
            onOpenChange={(open) => {
              if (!open && !remove.isPending) setDeleting(null)
            }}
            title='Delete supplier'
            desc={`Delete ${deleting.name}? Purchase orders keep their supplier reference as empty. Archived history is not changed.`}
            destructive
            confirmText='Delete'
            isLoading={remove.isPending}
            handleConfirm={() => {
              if (!eligibleRead || deleting.uuid !== uuid) return
              remove.mutate(deleting)
            }}
          />
        ) : null}
      </Main>
    </>
  )
}
