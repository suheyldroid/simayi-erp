import { useState, type FormEvent } from 'react'
import { t } from '@/lib/i18n'
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
            {creating
              ? t('operations:supplier.form.createTitle')
              : t('operations:supplier.form.editTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('operations:supplier.form.description')}
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
                  label: t('operations:supplier.form.name'),
                  required: true,
                  maxLength: 100,
                }}
                value={current?.name}
              />
              <FieldInput
                field={{
                  name: 'description',
                  label: t('operations:supplier.form.descriptionField'),
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
                alt={t('operations:supplier.form.imageAlt')}
                onChange={(next) => {
                  setImage(next.image)
                  setFile(next.file)
                }}
              />
              <div className='grid gap-3 sm:grid-cols-2'>
                <FieldInput
                  field={{
                    name: 'phone',
                    label: t('operations:supplier.form.phone'),
                    maxLength: 50,
                  }}
                  value={current?.phone}
                />
                <FieldInput
                  field={{
                    name: 'taxId',
                    label: t('operations:supplier.form.taxId'),
                    maxLength: 50,
                  }}
                  value={current?.taxId}
                />
              </div>
              <fieldset className='space-y-3 rounded-md border p-3'>
                <legend className='px-1 text-sm font-medium'>
                  {t('operations:supplier.form.contactLegend')}
                </legend>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <FieldInput
                    field={{
                      name: 'contact',
                      label: t('operations:supplier.form.contactName'),
                      maxLength: 100,
                    }}
                    value={current?.contact}
                  />
                  <FieldInput
                    field={{
                      name: 'contactPhone',
                      label: t('operations:supplier.form.contactPhone'),
                      maxLength: 100,
                    }}
                    value={current?.contactPhone}
                  />
                  <FieldInput
                    field={{
                      name: 'contactRole',
                      label: t('operations:supplier.form.contactRole'),
                      maxLength: 100,
                    }}
                    value={current?.contactRole}
                  />
                </div>
              </fieldset>
              <fieldset className='space-y-3 rounded-md border p-3'>
                <legend className='px-1 text-sm font-medium'>
                  {t('operations:supplier.form.addressLegend')}
                </legend>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <FieldInput
                    field={{
                      name: 'line1',
                      label: t('operations:supplier.form.line1'),
                      maxLength: 50,
                    }}
                    value={current?.line1}
                  />
                  <FieldInput
                    field={{
                      name: 'line2',
                      label: t('operations:supplier.form.line2'),
                      maxLength: 50,
                    }}
                    value={current?.line2}
                  />
                  <FieldInput
                    field={{
                      name: 'postalCode',
                      label: t('operations:supplier.form.postalCode'),
                      maxLength: 10,
                    }}
                    value={current?.postalCode}
                  />
                  <FieldInput
                    field={{
                      name: 'postalCity',
                      label: t('operations:supplier.form.postalCity'),
                      maxLength: 50,
                    }}
                    value={current?.postalCity}
                  />
                  <FieldInput
                    field={{
                      name: 'province',
                      label: t('operations:supplier.form.province'),
                      maxLength: 50,
                    }}
                    value={current?.province}
                  />
                  <FieldInput
                    field={{
                      name: 'country',
                      label: t('operations:supplier.form.country'),
                      maxLength: 50,
                    }}
                    value={current?.country}
                  />
                  <FieldInput
                    field={{
                      name: 'shippingNotes',
                      label: t('operations:supplier.form.shippingNotes'),
                      maxLength: 100,
                    }}
                    value={current?.shippingNotes}
                  />
                  <FieldInput
                    field={{
                      name: 'internalShippingNotes',
                      label: t(
                        'operations:supplier.form.internalShippingNotes'
                      ),
                      maxLength: 100,
                    }}
                    value={current?.internalShippingNotes}
                  />
                  <FieldInput
                    field={{
                      name: 'addressLink',
                      label: t('operations:supplier.form.addressLink'),
                      maxLength: 2000,
                    }}
                    value={current?.addressLink}
                  />
                </div>
              </fieldset>
              <FlagInput
                name='active'
                label={t('operations:supplier.form.active')}
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
              {t('operations:common.cancel')}
            </Button>
            <Button type='submit' disabled={busy}>
              {submitting
                ? t('operations:common.saving')
                : t('operations:common.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
