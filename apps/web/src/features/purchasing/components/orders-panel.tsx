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
import { commonApi } from '@/features/common/api'
import { FieldInput } from '@/features/common/components/field-input'
import { companyApi } from '@/features/company/api'
import { supplyApi } from '@/features/company/supply-api'
import { stockApi } from '@/features/stock/api'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, purchasingApi } from '../api'
import {
  PurchasingModel,
  type PurchaseLine,
  type PurchaseOrder,
} from '../model'

const statusLabels: Record<number, string> = {
  10: 'Pending',
  20: 'Placed',
  25: 'On hold',
  30: 'Complete',
  40: 'Cancelled',
  50: 'Lost',
  60: 'Returned',
}

function remaining(line: PurchaseLine) {
  return Number(line.quantity) - Number(line.received)
}

export function OrdersPanel({
  permissions,
}: {
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'purchase_order', 'add')
  const canChange = hasPermission(permissions, 'purchase_order', 'change')
  const canDelete = hasPermission(permissions, 'purchase_order', 'delete')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [openOnly, setOpenOnly] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [remove, setRemove] = useState(false)
  const orders = useQuery({
    queryKey: ['purchasing', 'orders', page, search, openOnly],
    queryFn: () => purchasingApi.orders({ page, search, open: openOnly }),
  })
  const refresh = async (order?: PurchaseOrder | null) => {
    await client.invalidateQueries({ queryKey: ['purchasing'] })
    await client.invalidateQueries({ queryKey: ['stock'] })
    if (order === null) {
      setSelected(null)
      return
    }
    const id = order?.id ?? selected?.id
    if (id != null) setSelected(await purchasingApi.order(id))
  }
  const creation = useMutation({
    mutationFn: purchasingApi.createOrder,
    onSuccess: async (order) => {
      await refresh(order)
      setCreating(false)
      toast.success(`Purchase order ${order.reference} created`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const action = useMutation({
    mutationFn: (input: {
      action: 'place' | 'hold' | 'cancel' | 'complete'
      acceptIncomplete?: boolean
    }) => {
      if (!selected) throw new Error('Choose an order')
      return purchasingApi.act(selected.id, input.action, {
        version: selected.version,
        acceptIncomplete: input.acceptIncomplete,
      })
    },
    onSuccess: async (order) => {
      await refresh(order)
      toast.success(`Order is ${statusLabels[order.status]?.toLowerCase()}`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (order: PurchaseOrder) =>
      purchasingApi.removeOrder(order.id, order.version),
    onSuccess: async () => {
      await refresh(null)
      setRemove(false)
      toast.success('Purchase order deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-lg font-medium'>Purchase orders</h2>
        {canAdd && !creating && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setCreating(true)}
          >
            New order
          </Button>
        )}
      </div>
      <p className='text-sm text-muted-foreground'>
        Place an order with a supplier, then receive lines into stock. A receipt
        creates stock items, including serial numbers for trackable parts, and
        records the receipt on the part history.
      </p>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
          placeholder='Search reference or supplier'
          className='max-w-sm'
        />
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={openOnly}
            onChange={(event) => {
              setOpenOnly(event.target.checked)
              setPage(0)
            }}
          />
          Open orders
        </label>
      </div>
      {creating && (
        <CreateOrder
          pending={creation.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(body) => creation.mutate(body)}
        />
      )}
      {orders.isPending && <p role='status'>Loading purchase orders…</p>}
      {orders.isError && <p role='alert'>{errorMessage(orders.error)}</p>}
      {orders.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.data.items.map((order) => (
                <TableRow
                  key={order.id}
                  data-state={
                    selected?.id === order.id ? 'selected' : undefined
                  }
                  onClick={() => setSelected(order)}
                >
                  <TableCell>{order.reference}</TableCell>
                  <TableCell>{order.supplier?.name ?? '—'}</TableCell>
                  <TableCell>{statusLabels[order.status]}</TableCell>
                  <TableCell>
                    {order.totalPrice
                      ? `${order.totalPrice} ${order.totalPriceCurrency ?? ''}`
                      : '—'}
                  </TableCell>
                  <TableCell>{order.targetDate ?? '—'}</TableCell>
                </TableRow>
              ))}
              {orders.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No purchase orders yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            hasNext={
              orders.data.offset + orders.data.items.length < orders.data.total
            }
            loading={orders.isFetching}
            onChange={setPage}
          />
        </>
      )}
      {selected && (
        <OrderDetail
          order={selected}
          canChange={canChange}
          canDelete={canDelete}
          pending={action.isPending}
          onAct={(name, acceptIncomplete) =>
            action.mutate({ action: name, acceptIncomplete })
          }
          onDelete={() => setRemove(true)}
          onChanged={refresh}
        />
      )}
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title='Delete purchase order'
        desc='Pending and cancelled orders can be deleted when nothing has been received.'
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

function CreateOrder({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean
  onSubmit: (body: {
    supplierId: number
    reference?: string
    description?: string
    supplierReference?: string
    contactId?: number
    addressId?: number
    destinationId?: number
    projectCodeId?: number
    orderCurrency?: string
    targetDate?: string
  }) => void
  onCancel: () => void
}) {
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [contactId, setContactId] = useState<number | null>(null)
  const [addressId, setAddressId] = useState<number | null>(null)
  const [destinationId, setDestinationId] = useState<number | null>(null)
  const [projectCodeId, setProjectCodeId] = useState<number | null>(null)
  const suppliers = useQuery({
    queryKey: ['company', 'suppliers', supplierSearch],
    queryFn: () => companyApi.list(0, supplierSearch, 'suppliers'),
    enabled: supplierSearch.trim().length > 0,
  })
  const contacts = useQuery({
    queryKey: ['company', 'contacts', supplierId],
    queryFn: () => companyApi.contacts(supplierId ?? 0),
    enabled: supplierId != null,
  })
  const addresses = useQuery({
    queryKey: ['company', 'addresses', supplierId],
    queryFn: () => companyApi.addresses(supplierId ?? 0),
    enabled: supplierId != null,
  })
  const projects = useQuery({
    queryKey: ['common', 'projects', 'purchasing'],
    queryFn: () => commonApi.projects(0, ''),
  })
  return (
    <form
      className='grid gap-3'
      onSubmit={(event) => {
        event.preventDefault()
        if (supplierId == null) {
          toast.error('Choose a supplier')
          return
        }
        const form = new FormData(event.currentTarget)
        const reference = String(form.get('reference') ?? '').trim()
        const description = String(form.get('description') ?? '').trim()
        const supplierReference = String(
          form.get('supplierReference') ?? ''
        ).trim()
        const orderCurrency = String(form.get('orderCurrency') ?? '')
          .trim()
          .toUpperCase()
        const targetDate = String(form.get('targetDate') ?? '').trim()
        try {
          onSubmit(
            PurchasingModel.orderInput.parse({
              supplierId,
              ...(reference === '' ? {} : { reference }),
              ...(description === '' ? {} : { description }),
              ...(supplierReference === '' ? {} : { supplierReference }),
              ...(contactId == null ? {} : { contactId }),
              ...(addressId == null ? {} : { addressId }),
              ...(destinationId == null ? {} : { destinationId }),
              ...(projectCodeId == null ? {} : { projectCodeId }),
              ...(orderCurrency === '' ? {} : { orderCurrency }),
              ...(targetDate === '' ? {} : { targetDate }),
            })
          )
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }}
    >
      <div className='space-y-2'>
        <Label>Supplier</Label>
        <Input
          value={supplierSearch}
          onChange={(event) => setSupplierSearch(event.target.value)}
          placeholder='Search suppliers'
        />
        {supplierName && <p className='text-sm'>Selected: {supplierName}</p>}
        <ul className='space-y-1'>
          {(suppliers.data?.items ?? []).slice(0, 8).map((company) => (
            <li key={company.id}>
              <Button
                type='button'
                variant='link'
                className='h-auto p-0'
                onClick={() => {
                  setSupplierId(company.id)
                  setSupplierName(company.name)
                  setContactId(null)
                  setAddressId(null)
                  setSupplierSearch('')
                }}
              >
                {company.name}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        <FieldInput
          field={{ name: 'reference', label: 'Reference', maxLength: 64 }}
        />
        <FieldInput
          field={{
            name: 'supplierReference',
            label: 'Supplier reference',
            maxLength: 64,
          }}
        />
        <FieldInput
          field={{ name: 'description', label: 'Description', maxLength: 250 }}
        />
        <FieldInput
          field={{ name: 'orderCurrency', label: 'Currency', maxLength: 3 }}
        />
        <FieldInput
          field={{ name: 'targetDate', label: 'Target date', type: 'text' }}
        />
      </div>
      <ContactChoice
        contacts={contacts.data?.items ?? []}
        addresses={addresses.data?.items ?? []}
        projects={(projects.data?.items ?? []).filter(
          (project) => project.active
        )}
        onContact={setContactId}
        onAddress={setAddressId}
        onProject={setProjectCodeId}
      />
      <LocationChoice onSelect={setDestinationId} label='Destination' />
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

function ContactChoice({
  contacts,
  addresses,
  projects,
  onContact,
  onAddress,
  onProject,
}: {
  contacts: { id: number; name: string }[]
  addresses: { id: number; title: string }[]
  projects: { id: number; code: string }[]
  onContact: (id: number | null) => void
  onAddress: (id: number | null) => void
  onProject: (id: number | null) => void
}) {
  return (
    <div className='grid gap-3 sm:grid-cols-3'>
      <label className='space-y-2 text-sm'>
        <span>Contact</span>
        <select
          className='w-full rounded-md border border-input bg-background px-3 py-2'
          defaultValue=''
          onChange={(event) =>
            onContact(
              event.target.value === '' ? null : Number(event.target.value)
            )
          }
        >
          <option value=''>None</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </select>
      </label>
      <label className='space-y-2 text-sm'>
        <span>Address</span>
        <select
          className='w-full rounded-md border border-input bg-background px-3 py-2'
          defaultValue=''
          onChange={(event) =>
            onAddress(
              event.target.value === '' ? null : Number(event.target.value)
            )
          }
        >
          <option value=''>None</option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.title}
            </option>
          ))}
        </select>
      </label>
      <label className='space-y-2 text-sm'>
        <span>Project</span>
        <select
          className='w-full rounded-md border border-input bg-background px-3 py-2'
          defaultValue=''
          onChange={(event) =>
            onProject(
              event.target.value === '' ? null : Number(event.target.value)
            )
          }
        >
          <option value=''>None</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code}
            </option>
          ))}
        </select>
      </label>
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
    queryKey: ['stock', 'locations', 'purchasing', search],
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
      {selected && <p className='text-sm'>Selected: {selected}</p>}
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

function OrderDetail({
  order,
  canChange,
  canDelete,
  pending,
  onAct,
  onDelete,
  onChanged,
}: {
  order: PurchaseOrder
  canChange: boolean
  canDelete: boolean
  pending: boolean
  onAct: (
    action: 'place' | 'hold' | 'cancel' | 'complete',
    acceptIncomplete?: boolean
  ) => void
  onDelete: () => void
  onChanged: (order?: PurchaseOrder | null) => Promise<void>
}) {
  const open = order.status === 10 || order.status === 20 || order.status === 25
  const lines = useQuery({
    queryKey: ['purchasing', 'lines', order.id],
    queryFn: () => purchasingApi.lines(order.id),
  })
  const extras = useQuery({
    queryKey: ['purchasing', 'extras', order.id],
    queryFn: () => purchasingApi.extras(order.id),
  })
  const [acceptIncomplete, setAcceptIncomplete] = useState(false)
  return (
    <div className='space-y-4 rounded-lg border p-3'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='font-medium'>
            {order.reference}
            {order.supplier ? ` · ${order.supplier.name}` : ''}
          </h3>
          <p className='text-sm text-muted-foreground'>
            {statusLabels[order.status]}
            {order.orderCurrency ? ` · ${order.orderCurrency}` : ''}
            {order.totalPrice
              ? ` · ${order.totalPrice} ${order.totalPriceCurrency ?? ''}`
              : ''}
            {order.destination ? ` · ${order.destination.pathstring}` : ''}
            {` · version ${order.version}`}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {canChange && (order.status === 10 || order.status === 25) && (
            <Button
              type='button'
              disabled={pending}
              onClick={() => onAct('place')}
            >
              Place
            </Button>
          )}
          {canChange && (order.status === 10 || order.status === 20) && (
            <Button
              type='button'
              variant='outline'
              disabled={pending}
              onClick={() => onAct('hold')}
            >
              Hold
            </Button>
          )}
          {canChange && open && (
            <Button
              type='button'
              variant='outline'
              disabled={pending}
              onClick={() => onAct('cancel')}
            >
              Cancel
            </Button>
          )}
          {canChange && order.status === 20 && (
            <Button
              type='button'
              disabled={pending}
              onClick={() => onAct('complete', acceptIncomplete)}
            >
              Complete
            </Button>
          )}
          {canDelete && (order.status === 10 || order.status === 40) && (
            <Button type='button' variant='outline' onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>
      {canChange && order.status === 20 && (
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={acceptIncomplete}
            onChange={(event) => setAcceptIncomplete(event.target.checked)}
          />
          Complete even when lines are not fully received
        </label>
      )}
      <Lines
        order={order}
        lines={lines.data?.items ?? []}
        pending={lines.isPending}
        error={lines.isError ? lines.error : null}
        canChange={canChange && open}
        onChanged={() => onChanged()}
      />
      <Extras
        order={order}
        extras={extras.data?.items ?? []}
        pending={extras.isPending}
        error={extras.isError ? extras.error : null}
        canChange={canChange && open}
        onChanged={() => onChanged()}
      />
      {canChange && order.status === 20 && (
        <Receive
          order={order}
          lines={(lines.data?.items ?? []).filter(
            (line) => remaining(line) > 0
          )}
          onChanged={() => onChanged()}
        />
      )}
    </div>
  )
}

function Lines({
  order,
  lines,
  pending,
  error,
  canChange,
  onChanged,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
  pending: boolean
  error: unknown
  canChange: boolean
  onChanged: () => Promise<void>
}) {
  const client = useQueryClient()
  const [partId, setPartId] = useState<number | null>(null)
  const parts = useQuery({
    queryKey: ['company', 'supplier-parts', order.supplierId],
    queryFn: () =>
      supplyApi.supplierParts({ supplierId: order.supplierId ?? 0 }),
    enabled: order.supplierId != null && canChange,
  })
  const save = useMutation({
    mutationFn: (body: {
      partId: number
      quantity: string
      purchasePrice?: string
    }) => purchasingApi.addLine(order.id, { version: order.version, ...body }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      await onChanged()
      toast.success('Line added')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (id: number) =>
      purchasingApi.removeLine(order.id, id, order.version),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      await onChanged()
      toast.success('Line deleted')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  return (
    <div className='space-y-2'>
      <h4 className='text-sm font-medium'>Lines</h4>
      {canChange && (
        <form
          className='grid gap-3 sm:grid-cols-2'
          onSubmit={(event) => {
            event.preventDefault()
            if (partId == null) {
              toast.error('Choose a supplier part')
              return
            }
            const form = new FormData(event.currentTarget)
            const price = String(form.get('purchasePrice') ?? '').trim()
            try {
              const parsed = PurchasingModel.lineInput.parse({
                version: order.version,
                partId,
                quantity: String(form.get('quantity') ?? ''),
                ...(price === '' ? {} : { purchasePrice: price }),
              })
              save.mutate(parsed)
            } catch (caught) {
              toast.error(errorMessage(caught))
            }
          }}
        >
          <label className='space-y-2 text-sm sm:col-span-2'>
            <span>Supplier part</span>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2'
              value={partId ?? ''}
              onChange={(event) =>
                setPartId(
                  event.target.value === '' ? null : Number(event.target.value)
                )
              }
            >
              <option value=''>Select…</option>
              {(parts.data?.items ?? []).map((part) => (
                <option key={part.id} value={part.id}>
                  {part.sku} · {part.part.name}
                </option>
              ))}
            </select>
          </label>
          <FieldInput
            field={{ name: 'quantity', label: 'Quantity', required: true }}
          />
          <FieldInput field={{ name: 'purchasePrice', label: 'Unit price' }} />
          <Button className='w-fit' type='submit' disabled={save.isPending}>
            Add line
          </Button>
        </form>
      )}
      {pending && <p role='status'>Loading lines…</p>}
      {error != null && <p role='alert'>{errorMessage(error)}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Part</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Price</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                {line.part ? `${line.part.sku} · ${line.part.partName}` : '—'}
              </TableCell>
              <TableCell>{line.quantity}</TableCell>
              <TableCell>{line.received}</TableCell>
              <TableCell>
                {line.purchasePrice
                  ? `${line.purchasePrice} ${line.purchasePriceCurrency ?? ''}`
                  : '—'}
              </TableCell>
              <TableCell>
                {canChange && Number(line.received) === 0 && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(line.id)}
                  >
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>No lines yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function Extras({
  order,
  extras,
  pending,
  error,
  canChange,
  onChanged,
}: {
  order: PurchaseOrder
  extras: {
    id: number
    description: string
    quantity: string
    price: string | null
    priceCurrency: string | null
  }[]
  pending: boolean
  error: unknown
  canChange: boolean
  onChanged: () => Promise<void>
}) {
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: (body: {
      description?: string
      quantity: string
      price?: string
    }) => purchasingApi.addExtra(order.id, { version: order.version, ...body }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      await onChanged()
      toast.success('Extra line added')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (id: number) =>
      purchasingApi.removeExtra(order.id, id, order.version),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      await onChanged()
      toast.success('Extra line deleted')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  return (
    <div className='space-y-2'>
      <h4 className='text-sm font-medium'>Extra lines</h4>
      {canChange && (
        <form
          className='grid gap-3 sm:grid-cols-3'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const price = String(form.get('price') ?? '').trim()
            const description = String(form.get('description') ?? '').trim()
            try {
              const parsed = PurchasingModel.extraInput.parse({
                version: order.version,
                quantity: String(form.get('quantity') ?? ''),
                ...(description === '' ? {} : { description }),
                ...(price === '' ? {} : { price }),
              })
              save.mutate(parsed)
              event.currentTarget.reset()
            } catch (caught) {
              toast.error(errorMessage(caught))
            }
          }}
        >
          <FieldInput
            field={{
              name: 'description',
              label: 'Description',
              maxLength: 250,
            }}
          />
          <FieldInput
            field={{ name: 'quantity', label: 'Quantity', required: true }}
          />
          <FieldInput field={{ name: 'price', label: 'Price' }} />
          <Button className='w-fit' type='submit' disabled={save.isPending}>
            Add extra
          </Button>
        </form>
      )}
      {pending && <p role='status'>Loading extra lines…</p>}
      {error != null && <p role='alert'>{errorMessage(error)}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Price</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {extras.map((line) => (
            <TableRow key={line.id}>
              <TableCell>{line.description || '—'}</TableCell>
              <TableCell>{line.quantity}</TableCell>
              <TableCell>
                {line.price ? `${line.price} ${line.priceCurrency ?? ''}` : '—'}
              </TableCell>
              <TableCell>
                {canChange && (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(line.id)}
                  >
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {extras.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>No extra lines yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function Receive({
  order,
  lines,
  onChanged,
}: {
  order: PurchaseOrder
  lines: PurchaseLine[]
  onChanged: () => Promise<void>
}) {
  const client = useQueryClient()
  const [lineId, setLineId] = useState<number | null>(lines[0]?.id ?? null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const line = lines.find((item) => item.id === lineId) ?? null
  const save = useMutation({
    mutationFn: (body: {
      lineId: number
      quantity: string
      serials?: string
      batch?: string
      locationId?: number
    }) =>
      purchasingApi.receive(order.id, {
        version: order.version,
        items: [body],
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['purchasing'] })
      await client.invalidateQueries({ queryKey: ['stock'] })
      await onChanged()
      toast.success(
        result.items.length === 1
          ? 'Stock item received'
          : `${result.items.length} stock items received`
      )
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  if (lines.length === 0) return null
  return (
    <form
      className='grid gap-3'
      onSubmit={(event) => {
        event.preventDefault()
        if (line == null) {
          toast.error('Choose a line')
          return
        }
        const form = new FormData(event.currentTarget)
        const serials = String(form.get('serials') ?? '').trim()
        const batch = String(form.get('batch') ?? '').trim()
        try {
          const parsed = PurchasingModel.receiveInput.parse({
            version: order.version,
            items: [
              {
                lineId: line.id,
                quantity: String(form.get('quantity') ?? ''),
                ...(serials === '' ? {} : { serials }),
                ...(batch === '' ? {} : { batch }),
                ...(locationId == null ? {} : { locationId }),
              },
            ],
          })
          const item = parsed.items[0]
          if (!item) return
          save.mutate(item)
        } catch (caught) {
          toast.error(errorMessage(caught))
        }
      }}
    >
      <h4 className='text-sm font-medium'>Receive</h4>
      <label className='space-y-2 text-sm'>
        <span>Line</span>
        <select
          className='w-full rounded-md border border-input bg-background px-3 py-2'
          value={line?.id ?? ''}
          onChange={(event) => setLineId(Number(event.target.value))}
        >
          {lines.map((item) => (
            <option key={item.id} value={item.id}>
              {item.part ? `${item.part.sku} · ${item.part.partName}` : item.id}{' '}
              · {remaining(item)} outstanding
            </option>
          ))}
        </select>
      </label>
      <div className='grid gap-3 sm:grid-cols-2'>
        <FieldInput
          field={{
            name: 'quantity',
            label: 'Quantity to receive',
            required: true,
          }}
        />
        <FieldInput field={{ name: 'batch', label: 'Batch', maxLength: 100 }} />
        {line?.part?.trackable && (
          <FieldInput
            field={{
              name: 'serials',
              label: 'Serial numbers',
              required: true,
            }}
          />
        )}
      </div>
      <LocationChoice label='Location' onSelect={setLocationId} />
      <Button className='w-fit' type='submit' disabled={save.isPending}>
        Receive
      </Button>
    </form>
  )
}
