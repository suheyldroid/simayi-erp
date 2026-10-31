import { ZodError } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldInput } from '@/features/common/components/field-input'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { errorMessage } from '../api'
import { CompanyModel, type Company, type CompanyInput } from '../model'
import { FlagInput } from './flag-input'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function parseCompany(form: FormData): CompanyInput {
  try {
    const currency = text(form, 'currency').trim().toUpperCase()
    const metadata = text(form, 'metadata').trim()
    return CompanyModel.body.parse({
      name: text(form, 'name'),
      description: text(form, 'description'),
      website: text(form, 'website'),
      phone: text(form, 'phone'),
      email: text(form, 'email').trim() || null,
      contact: text(form, 'contact'),
      link: text(form, 'link'),
      image: text(form, 'image').trim() || null,
      active: form.has('active'),
      isCustomer: form.has('isCustomer'),
      isSupplier: form.has('isSupplier'),
      isManufacturer: form.has('isManufacturer'),
      currency: currency || undefined,
      taxId: text(form, 'taxId'),
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

export function CompanyForm({
  company,
  effective,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  company: Company | 'new'
  effective: EffectivePermissions
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: CompanyInput) => void
}) {
  const creating = company === 'new'
  const current = creating ? undefined : company
  const addSales = hasPermission(effective, 'sales_order', 'add')
  const addPurchase = hasPermission(effective, 'purchase_order', 'add')
  const changeSales = hasPermission(effective, 'sales_order', 'change')
  const changePurchase = hasPermission(effective, 'purchase_order', 'change')
  const customerEnabled = creating ? addSales : changeSales
  const supplierEnabled = creating ? addPurchase : changePurchase
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
            {creating ? 'Create company' : 'Edit company'}
          </DialogTitle>
          <DialogDescription>
            A company can be a customer, supplier, manufacturer, or any
            combination of those roles.
          </DialogDescription>
        </DialogHeader>
        <form
          key={creating ? 'new' : company.id}
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(parseCompany(new FormData(event.currentTarget)))
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
                required: true,
                maxLength: 500,
                type: 'textarea',
              }}
              value={current?.description}
            />
            <FieldInput
              field={{ name: 'website', label: 'Website', maxLength: 2000 }}
              value={current?.website}
            />
            <FieldInput
              field={{ name: 'phone', label: 'Phone', maxLength: 50 }}
              value={current?.phone}
            />
            <FieldInput
              field={{ name: 'email', label: 'Email', maxLength: 254 }}
              value={current?.email ?? ''}
            />
            <FieldInput
              field={{ name: 'contact', label: 'Contact', maxLength: 100 }}
              value={current?.contact}
            />
            <FieldInput
              field={{ name: 'link', label: 'Link', maxLength: 2000 }}
              value={current?.link}
            />
            <FieldInput
              field={{
                name: 'image',
                label: 'Image path',
                maxLength: 100,
              }}
              value={current?.image ?? ''}
            />
            <FieldInput
              field={{
                name: 'currency',
                label: creating
                  ? 'Currency (blank uses the system default)'
                  : 'Currency',
                required: !creating,
                maxLength: 3,
                pattern: '[A-Z]{3}',
              }}
              value={current?.currency ?? ''}
            />
            <FieldInput
              field={{ name: 'taxId', label: 'Tax ID', maxLength: 50 }}
              value={current?.taxId}
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
              name='active'
              label='Active'
              defaultChecked={current?.active ?? true}
            />
            <div className='space-y-2'>
              <p className='text-sm font-medium'>Roles</p>
              <FlagInput
                name='isCustomer'
                label='Customer'
                defaultChecked={
                  current?.isCustomer ?? (!addPurchase && addSales)
                }
                disabled={!customerEnabled && !current?.isCustomer}
              />
              <FlagInput
                name='isSupplier'
                label='Supplier'
                defaultChecked={current?.isSupplier ?? addPurchase}
                disabled={!supplierEnabled && !current?.isSupplier}
              />
              <FlagInput
                name='isManufacturer'
                label='Manufacturer'
                defaultChecked={current?.isManufacturer ?? false}
                disabled={!supplierEnabled && !current?.isManufacturer}
              />
            </div>
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
