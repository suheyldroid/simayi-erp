import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldInput } from '@/features/common/components/field-input'
import { FlagInput } from '@/features/company/components/flag-input'
import { errorMessage, partApi } from '../api'
import { PartModel, type Part, type PartInput } from '../model'

const flags = [
  ['isTemplate', 'Template'],
  ['assembly', 'Assembly'],
  ['component', 'Component'],
  ['trackable', 'Trackable'],
  ['testable', 'Testable'],
  ['purchaseable', 'Purchaseable'],
  ['salable', 'Salable'],
  ['virtual', 'Virtual'],
  ['consumable', 'Consumable'],
  ['active', 'Active'],
  ['locked', 'Locked'],
] as const

export type PartDraft = {
  mode: 'create' | 'edit' | 'variant' | 'revision'
  part: Part | null
}

function text(part: Part | null, value: string | number | null | undefined) {
  if (part == null || value == null) return ''
  return String(value)
}

export function PartForm({
  draft,
  onOpenChange,
  onSaved,
}: {
  draft: PartDraft | null
  onOpenChange: (open: boolean) => void
  onSaved: (part: Part) => void
}) {
  const client = useQueryClient()
  const source = draft?.part ?? null
  const editing = draft?.mode === 'edit'
  const locked = editing && source?.locked === true
  const save = useMutation({
    mutationFn: (input: { body: PartInput; id?: number }) =>
      partApi.savePart(input.body, input.id),
    onSuccess: async (part) => {
      await client.invalidateQueries({ queryKey: ['part'] })
      toast.success(editing ? 'Part updated' : 'Part created')
      onSaved(part)
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Dialog open={draft != null} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {draft?.mode === 'variant'
              ? 'New variant'
              : draft?.mode === 'revision'
                ? 'New revision'
                : editing
                  ? 'Edit part'
                  : 'New part'}
          </DialogTitle>
          <DialogDescription>
            Variants point at a template part. Revisions are separate parts
            with their own stock and parameters. A template cannot itself be a
            revision.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form
            key={`${draft.mode}-${source?.id ?? 'new'}-${source?.version ?? 0}`}
            className='space-y-4'
            onSubmit={(event) => {
              event.preventDefault()
              if (!draft) return
              const form = new FormData(event.currentTarget)
              try {
              if (locked && source) {
                save.mutate({
                  id: source.id,
                  body: {
                    version: source.version,
                    locked: form.has('locked'),
                  },
                })
                return
              }
              const location = String(form.get('defaultLocationId') ?? '').trim()
              const keywords = String(form.get('keywords') ?? '').trim()
              const variantOf = String(form.get('variantOfId') ?? '').trim()
              const revisionOf = String(form.get('revisionOfId') ?? '').trim()
              const creating = draft.mode !== 'edit'
              save.mutate({
                id: editing ? source?.id : undefined,
                body: PartModel.partInput.parse({
                  name: String(form.get('name') ?? ''),
                  description: String(form.get('description') ?? ''),
                  image: String(form.get('image') ?? ''),
                  barcodeData: String(form.get('barcodeData') ?? ''),
                  ipn: String(form.get('ipn') ?? ''),
                  revision: String(form.get('revision') ?? ''),
                  link: String(form.get('link') ?? ''),
                  units: String(form.get('units') ?? ''),
                  categoryId: String(form.get('categoryId') ?? ''),
                  responsibleOwnerId: String(
                    form.get('responsibleOwnerId') ?? ''
                  ),
                  minimumStock: String(form.get('minimumStock') ?? '0'),
                  maximumStock: String(form.get('maximumStock') ?? '0'),
                  baseCost: String(form.get('baseCost') ?? '0'),
                  multiple: Number(form.get('multiple') ?? 1),
                  defaultExpiry: Number(form.get('defaultExpiry') ?? 0),
                  ...(creating && location === ''
                    ? {}
                    : { defaultLocationId: location }),
                  ...(creating && keywords === '' ? {} : { keywords }),
                  ...(creating && variantOf === ''
                    ? {}
                    : { variantOfId: variantOf }),
                  ...(creating && revisionOf === ''
                    ? {}
                    : { revisionOfId: revisionOf }),
                  ...Object.fromEntries(
                    flags.map(([name]) => [name, form.has(name)])
                  ),
                  ...(editing && source ? { version: source.version } : {}),
                }),
              })
              } catch (error) {
                toast.error(errorMessage(error))
              }
            }}
          >
            {locked && (
              <p className='text-sm'>
                This part is locked. Unlock it and save before changing other
                fields. Locked parts also keep their parameters fixed.
              </p>
            )}
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldInput
                field={{ name: 'name', label: 'Name', required: true, maxLength: 100 }}
                value={text(source, source?.name)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'ipn', label: 'IPN', maxLength: 100 }}
                value={draft.mode === 'variant' ? '' : text(source, source?.ipn)}
                disabled={locked}
              />
              <FieldInput
                field={{
                  name: 'revision',
                  label: 'Revision',
                  maxLength: 100,
                  required: draft.mode === 'revision',
                }}
                value={
                  draft.mode === 'revision' || draft.mode === 'variant'
                    ? ''
                    : text(source, source?.revision)
                }
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'categoryId', label: 'Category ID', type: 'number', min: 1 }}
                value={text(source, source?.categoryId)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'variantOfId', label: 'Variant of template ID', type: 'number', min: 1 }}
                value={
                  draft.mode === 'variant'
                    ? text(source, source?.id)
                    : text(source, source?.variantOfId)
                }
                disabled={locked || draft.mode === 'variant'}
              />
              <FieldInput
                field={{ name: 'revisionOfId', label: 'Revision of part ID', type: 'number', min: 1 }}
                value={
                  draft.mode === 'revision'
                    ? text(source, source?.id)
                    : text(source, source?.revisionOfId)
                }
                disabled={locked || draft.mode === 'revision'}
              />
              <FieldInput
                field={{ name: 'defaultLocationId', label: 'Default location ID', type: 'number', min: 1 }}
                value={text(source, source?.defaultLocationId)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'responsibleOwnerId', label: 'Responsible owner ID', type: 'number', min: 1 }}
                value={text(source, source?.responsibleOwnerId)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'units', label: 'Units', maxLength: 20 }}
                value={text(source, source?.units)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'multiple', label: 'Order multiple', type: 'number', min: 1 }}
                value={source ? String(source.multiple) : '1'}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'minimumStock', label: 'Minimum stock', pattern: '\\d+(\\.\\d{1,6})?' }}
                value={source?.minimumStock ?? '0'}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'maximumStock', label: 'Maximum stock', pattern: '\\d+(\\.\\d{1,6})?' }}
                value={source?.maximumStock ?? '0'}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'baseCost', label: 'Base cost', pattern: '\\d+(\\.\\d{1,6})?' }}
                value={source?.baseCost ?? '0'}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'defaultExpiry', label: 'Default expiry days', type: 'number', min: 0 }}
                value={source ? String(source.defaultExpiry) : '0'}
                disabled={locked}
              />
            </div>
            <FieldInput
              field={{ name: 'description', label: 'Description', type: 'textarea', maxLength: 250 }}
              value={text(source, source?.description)}
              disabled={locked}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldInput
                field={{ name: 'keywords', label: 'Keywords', maxLength: 250 }}
                value={text(source, source?.keywords)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'link', label: 'Link', maxLength: 2000 }}
                value={text(source, source?.link)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'image', label: 'Image path', maxLength: 100 }}
                value={text(source, source?.image)}
                disabled={locked}
              />
              <FieldInput
                field={{ name: 'barcodeData', label: 'Barcode', maxLength: 500 }}
                value={draft.mode === 'edit' ? text(source, source?.barcodeData) : ''}
                disabled={locked}
              />
            </div>
            <div className='grid gap-3 sm:grid-cols-3'>
              {flags.map(([name, label]) => (
                <FlagInput
                  key={name}
                  name={name}
                  label={label}
                  disabled={locked && name !== 'locked'}
                  defaultChecked={
                    source
                      ? name === 'isTemplate'
                        ? draft.mode === 'edit' && source.isTemplate
                        : source[name]
                      : name === 'component' || name === 'active'
                  }
                />
              ))}
            </div>
            <p className='text-muted-foreground text-sm'>
              Leave location and keywords empty when creating a part to inherit
              them from the category. Category parameter defaults are copied
              onto the new part, except templates that require unique values.
              Owner IDs come from Users → Ownership.
            </p>
            <DialogFooter>
              <Button type='submit' disabled={save.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
