import { useId, useState } from 'react'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FieldInput } from '@/components/field-input'
import {
  SupplierSelect,
  type SupplierOption,
} from '@/features/supplier/components/supplier-select'
import { errorMessage } from '../api'
import { PurchasingModel, type OrderInput } from '../model'

/** Supplier identity used when a fixed supplier context binds the form. */
export type PurchaseOrderSupplier = SupplierOption

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

export function PurchaseOrderForm({
  pending,
  error,
  fixedSupplier,
  branch,
  onClose,
  onSubmit,
}: {
  pending: boolean
  error: unknown
  /** When set, the order is bound to this supplier and no picker is shown. */
  fixedSupplier?: PurchaseOrderSupplier
  /** Selected workspace branch; null means Company context. */
  branch?: { uuid: string; name: string } | null
  onClose: () => void
  onSubmit: (body: OrderInput) => void
}) {
  const targetDateId = useId()
  const [supplier, setSupplier] = useState<PurchaseOrderSupplier | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const chosenSupplier = fixedSupplier ?? supplier
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{t('operations:purchasing.create.title')}</SheetTitle>
          <SheetDescription>
            {t('operations:purchasing.create.description')}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (!chosenSupplier) {
              setValidationError(
                t('operations:purchasing.create.chooseSupplier')
              )
              return
            }
            const form = new FormData(event.currentTarget)
            const reference = text(form, 'reference').trim()
            const description = text(form, 'description').trim()
            const supplierReference = text(form, 'supplierReference').trim()
            const targetDate = text(form, 'targetDate').trim()
            const origin = String(form.get('origin') ?? 'company')
            try {
              const body = PurchasingModel.orderInput.parse({
                supplierUuid: chosenSupplier.uuid,
                branchUuid: origin === 'company' ? null : origin,
                ...(reference === '' ? {} : { reference }),
                ...(description === '' ? {} : { description }),
                ...(supplierReference === '' ? {} : { supplierReference }),
                ...(targetDate === '' ? {} : { targetDate }),
              })
              setValidationError(null)
              onSubmit(body)
            } catch (caught) {
              setValidationError(errorMessage(caught))
            }
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              {fixedSupplier ? (
                <div className='space-y-2'>
                  <p className='text-sm font-medium'>
                    {t('operations:purchasing.create.supplier')}
                  </p>
                  <p className='text-sm'>
                    {fixedSupplier.name}
                    {fixedSupplier.contact ? ` · ${fixedSupplier.contact}` : ''}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {t('operations:purchasing.create.fixedSupplierHint')}
                  </p>
                </div>
              ) : (
                <SupplierSelect
                  label={t('operations:purchasing.create.supplier')}
                  value={supplier}
                  disabled={pending}
                  onChange={setSupplier}
                />
              )}
              <FieldInput
                field={{
                  name: 'origin',
                  label: t('operations:purchasing.create.origin'),
                  type: 'select',
                  required: true,
                  defaultValue: branch?.uuid ?? 'company',
                  options: [
                    {
                      value: 'company',
                      label: t('operations:purchasing.companyOrigin'),
                    },
                    ...(branch == null
                      ? []
                      : [
                          {
                            value: branch.uuid,
                            label: t('operations:purchasing.branchOption', {
                              branch: branch.name,
                            }),
                          },
                        ]),
                  ],
                }}
              />
              <p className='text-xs text-muted-foreground'>
                {t('operations:purchasing.create.originHint')}
              </p>
              <FieldInput
                field={{
                  name: 'reference',
                  label: t('operations:purchasing.create.reference'),
                  maxLength: 64,
                }}
              />
              <FieldInput
                field={{
                  name: 'description',
                  label: t('operations:purchasing.create.descriptionField'),
                  maxLength: 250,
                  type: 'textarea',
                }}
              />
              <FieldInput
                field={{
                  name: 'supplierReference',
                  label: t('operations:purchasing.create.supplierReference'),
                  maxLength: 64,
                }}
              />
              <div className='space-y-2'>
                <Label htmlFor={targetDateId}>
                  {t('operations:purchasing.create.targetDate')}
                </Label>
                <Input id={targetDateId} name='targetDate' type='date' />
              </div>
              <p className='text-sm text-muted-foreground'>
                {t('operations:purchasing.create.hint')}
              </p>
            </fieldset>
            {(validationError != null || error != null) && (
              <p role='alert' className='text-destructive'>
                {validationError ?? errorMessage(error)}
              </p>
            )}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={pending}
            >
              {t('operations:common.cancel')}
            </Button>
            <Button type='submit' disabled={pending}>
              {t('operations:purchasing.create.submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
