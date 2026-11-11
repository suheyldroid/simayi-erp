import { useState, type FormEvent } from 'react'
import { imageUrl } from '@/lib/image-url'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FieldInput } from '@/components/field-input'
import { FlagInput } from '@/components/flag-input'
import { ImageInput } from '@/components/image-input'
import { errorMessage } from '../api'
import { supplierImageApi, supplierImagePrefix } from '../image-api'
import { SupplierModel, type Supplier, type SupplierInput } from '../model'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

function parseSupplier(form: FormData, image: string | null): SupplierInput {
  return SupplierModel.body.parse({
    name: text(form, 'name'),
    description: text(form, 'description'),
    phone: text(form, 'phone'),
    contact: text(form, 'contact'),
    contactPhone: text(form, 'contactPhone'),
    contactRole: text(form, 'contactRole'),
    image,
    active: form.has('active'),
    taxId: text(form, 'taxId'),
    line1: text(form, 'line1'),
    line2: text(form, 'line2'),
    postalCode: text(form, 'postalCode'),
    postalCity: text(form, 'postalCity'),
    province: text(form, 'province'),
    country: text(form, 'country'),
    shippingNotes: text(form, 'shippingNotes'),
    internalShippingNotes: text(form, 'internalShippingNotes'),
    addressLink: text(form, 'addressLink'),
  })
}

export function SupplierForm({
  supplier,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  supplier: Supplier | 'new'
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: SupplierInput, scope: string) => Promise<void>
}) {
  const creating = supplier === 'new'
  const current = creating ? undefined : supplier
  const [image, setImage] = useState<string | null>(current?.image ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const busy = pending || submitting

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setValidationError(null)
    setLocalError(null)
    let body: SupplierInput
    try {
      body = parseSupplier(new FormData(event.currentTarget), image)
    } catch (caught) {
      setValidationError(errorMessage(caught))
      return
    }
    // Capture the tenant that started the mutation; uploads and cache writes
    // must never follow a later organization switch.
    const scope = organizationCacheScope()
    setSubmitting(true)
    try {
      let imageRef = image
      if (file) {
        const uploaded = await supplierImageApi.upload(file)
        imageRef = uploaded.image
        // Keep the uploaded reference even if the supplier save fails, so a
        // retry never uploads the same file twice.
        setImage(uploaded.image)
        setFile(null)
      }
      await onSubmit({ ...body, image: imageRef }, scope)
    } catch (caught) {
      setLocalError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const displayedError =
    validationError ??
    localError ??
    (submitting || error == null ? null : errorMessage(error))

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-xl'
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {creating ? 'Create supplier' : 'Edit supplier'}
          </SheetTitle>
          <SheetDescription>
            Supplier and contact details, with the primary delivery address.
          </SheetDescription>
        </SheetHeader>
        <form
          key={creating ? 'new' : supplier.uuid}
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => void submit(event)}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={busy} className='space-y-4'>
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
              <ImageInput
                image={image}
                file={file}
                disabled={busy}
                resolveImage={imageUrl}
                credentialImagePrefix={supplierImagePrefix}
                alt='Supplier image preview'
                onChange={(next) => {
                  setImage(next.image)
                  setFile(next.file)
                }}
              />
              <div className='grid gap-3 sm:grid-cols-2'>
                <FieldInput
                  field={{ name: 'phone', label: 'Phone', maxLength: 50 }}
                  value={current?.phone}
                />
                <FieldInput
                  field={{ name: 'taxId', label: 'Tax ID', maxLength: 50 }}
                  value={current?.taxId}
                />
              </div>
              <fieldset className='space-y-3 rounded-md border p-3'>
                <legend className='px-1 text-sm font-medium'>Contact</legend>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <FieldInput
                    field={{ name: 'contact', label: 'Name', maxLength: 100 }}
                    value={current?.contact}
                  />
                  <FieldInput
                    field={{
                      name: 'contactPhone',
                      label: 'Phone',
                      maxLength: 100,
                    }}
                    value={current?.contactPhone}
                  />
                  <FieldInput
                    field={{
                      name: 'contactRole',
                      label: 'Role',
                      maxLength: 100,
                    }}
                    value={current?.contactRole}
                  />
                </div>
              </fieldset>
              <fieldset className='space-y-3 rounded-md border p-3'>
                <legend className='px-1 text-sm font-medium'>Address</legend>
                <div className='grid gap-3 sm:grid-cols-2'>
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
                    field={{
                      name: 'postalCity',
                      label: 'Postal city',
                      maxLength: 50,
                    }}
                    value={current?.postalCity}
                  />
                  <FieldInput
                    field={{
                      name: 'province',
                      label: 'Province',
                      maxLength: 50,
                    }}
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
                    field={{
                      name: 'addressLink',
                      label: 'Address link',
                      maxLength: 2000,
                    }}
                    value={current?.addressLink}
                  />
                </div>
              </fieldset>
              <FlagInput
                name='active'
                label='Active'
                defaultChecked={current?.active ?? true}
              />
            </fieldset>
            {displayedError != null && (
              <p role='alert' className='text-destructive'>
                {displayedError}
              </p>
            )}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={busy}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
