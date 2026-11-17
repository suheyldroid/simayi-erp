import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
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
import {
  UnitSelect,
  type UnitOption,
} from '@/features/units/components/unit-select'
import { errorMessage, itemApi } from '../api'
import { itemImageApi, itemImagePrefix } from '../image-api'
import { ItemsModel, type Item, type ItemInput } from '../model'
import {
  ItemCategorySelect,
  type ItemCategoryOption,
} from './item-category-select'

export type ItemDraft = { mode: 'create' } | { mode: 'edit'; item: Item }

function text(item: Item | null, value: string | number | null | undefined) {
  if (item == null || value == null) return ''
  return String(value)
}

export function ItemForm({
  draft,
  canSubmit,
  onOpenChange,
  onSaved,
}: {
  draft: ItemDraft | null
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (item: Item) => void
}) {
  if (draft == null) return null
  return (
    <ItemFormSheet
      key={draft.mode === 'edit' ? `edit-${draft.item.uuid}` : 'create'}
      draft={draft}
      canSubmit={canSubmit}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  )
}

function ItemFormSheet({
  draft,
  canSubmit,
  onOpenChange,
  onSaved,
}: {
  draft: ItemDraft
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (item: Item) => void
}) {
  const client = useQueryClient()
  const source = draft.mode === 'edit' ? draft.item : null
  const editing = draft.mode === 'edit'
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<ItemCategoryOption | null>(
    source?.category ?? null
  )
  const [categoryUuid, setCategoryUuid] = useState<string | null>(
    source?.categoryUuid ?? null
  )
  const [unit, setUnit] = useState<UnitOption | null>(source?.unit ?? null)
  const [unitUuid, setUnitUuid] = useState<string | null>(
    source?.unitUuid ?? null
  )
  const [image, setImage] = useState<string | null>(source?.image ?? null)
  const [file, setFile] = useState<File | null>(null)
  const save = useMutation({
    mutationFn: async (input: {
      body: ItemInput
      uuid?: string
      file: File | null
      scope: string
    }) => {
      let imageRef = input.body.image ?? null
      if (input.file) {
        const uploaded = await itemImageApi.upload(input.file)
        imageRef = uploaded.image
        setImage(uploaded.image)
        setFile(null)
      }
      return itemApi.saveItem({ ...input.body, image: imageRef }, input.uuid)
    },
    onSuccess: async (item, input) => {
      await invalidateItemStockCaches(client, input.scope)
      // Branch balances embed the shared item name/unit: the catalog change is
      // company-wide, so refresh every branch stock view of this company.
      await client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'stock' &&
          typeof query.queryKey[1] === 'string' &&
          query.queryKey[1].startsWith(`${input.scope}::`),
      })
      await client.invalidateQueries({ queryKey: ['item-category'] })
      // Recipe catalog/picker keys are branch-scoped as
      // ['recipe', '<organization scope>::<branch>', ...]. A shared item edit
      // affects every branch definition and picker of this company only.
      await client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'recipe' &&
          typeof query.queryKey[1] === 'string' &&
          query.queryKey[1].startsWith(`${input.scope}::`),
      })
      toast.success(
        editing
          ? t('catalog:items.form.updatedToast')
          : t('catalog:items.form.createdToast')
      )
      onSaved?.(item)
      onOpenChange(false)
    },
    onError: (caught) => setError(errorMessage(caught)),
  })

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next && save.isPending) return
        onOpenChange(next)
      }}
    >
      <SheetContent
        className='w-full gap-0 sm:max-w-2xl'
        onEscapeKeyDown={(event) => {
          if (save.isPending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (save.isPending) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {editing
              ? t('catalog:items.form.editTitle')
              : t('catalog:items.form.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('catalog:items.form.description')}
          </SheetDescription>
        </SheetHeader>
        <form
          key={`${draft.mode}-${source?.uuid ?? ''}`}
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (!canSubmit || save.isPending) return
            setError(null)
            const form = new FormData(event.currentTarget)
            const chosenUnitUuid = unit?.uuid ?? null
            if (!editing && chosenUnitUuid == null) {
              setError(t('catalog:items.form.unitRequired'))
              return
            }
            const unitChanged =
              chosenUnitUuid != null &&
              chosenUnitUuid !== (source?.unitUuid ?? null)
            try {
              const body = ItemsModel.itemInput.parse({
                name: String(form.get('name') ?? ''),
                description: String(form.get('description') ?? ''),
                image: image ?? '',
                categoryUuid: categoryUuid ?? '',
                ...(unitChanged ? { unitUuid: chosenUnitUuid } : {}),
                ipn: String(form.get('ipn') ?? ''),
                defaultExpiry: Number(form.get('defaultExpiry') ?? 0),
                active: form.has('active'),
                ...(editing && source ? { version: source.version } : {}),
              })
              save.mutate({
                uuid: editing ? source?.uuid : undefined,
                file,
                body,
                scope: organizationCacheScope(),
              })
            } catch (caught) {
              setError(errorMessage(caught))
            }
          }}
        >
          <fieldset
            disabled={save.isPending}
            className='min-w-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4'
          >
            {error && (
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldInput
                field={{
                  name: 'name',
                  label: t('catalog:items.form.nameLabel'),
                  required: true,
                  maxLength: 100,
                }}
                value={text(source, source?.name)}
              />
              <FieldInput
                field={{
                  name: 'ipn',
                  label: t('catalog:items.form.ipnLabel'),
                  maxLength: 100,
                }}
                value={text(source, source?.ipn)}
              />
              <ItemCategorySelect
                value={category}
                fallbackUuid={category == null ? categoryUuid : null}
                disabled={save.isPending}
                onChange={(next) => {
                  setCategory(next)
                  setCategoryUuid(next?.uuid ?? null)
                }}
              />
              <UnitSelect
                value={unit}
                fallbackUuid={unit == null ? unitUuid : null}
                disabled={save.isPending}
                onChange={(next) => {
                  setUnit(next)
                  setUnitUuid(next?.uuid ?? null)
                }}
              />
              {editing && source?.unitUuid == null && (
                <p className='text-xs text-muted-foreground sm:col-span-2'>
                  {t('catalog:items.form.noUnitAssigned')}
                </p>
              )}
              {editing && source?.unitUuid != null && (
                <p className='text-xs text-muted-foreground sm:col-span-2'>
                  {t('catalog:items.form.unitChangeBlocked')}
                </p>
              )}
              {unit != null && !unit.active && (
                <p className='text-xs text-muted-foreground sm:col-span-2'>
                  {t('catalog:items.form.unitInactive')}
                </p>
              )}
              <FieldInput
                field={{
                  name: 'defaultExpiry',
                  label: t('catalog:items.form.defaultExpiryLabel'),
                  type: 'number',
                  min: 0,
                }}
                value={source ? String(source.defaultExpiry) : '0'}
              />
            </div>
            <ImageInput
              image={image}
              file={file}
              disabled={save.isPending}
              resolveImage={imageUrl}
              credentialImagePrefix={itemImagePrefix}
              alt={t('catalog:items.form.imageAlt')}
              onChange={(next) => {
                setImage(next.image)
                setFile(next.file)
              }}
            />
            <FieldInput
              field={{
                name: 'description',
                label: t('catalog:items.form.descriptionLabel'),
                type: 'textarea',
                maxLength: 250,
              }}
              value={text(source, source?.description)}
            />
            <FlagInput
              name='active'
              label={t('catalog:items.form.activeLabel')}
              defaultChecked={source ? source.active : true}
            />
          </fieldset>
          <SheetFooter className='border-t border-border'>
            <Button
              type='button'
              variant='outline'
              disabled={save.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t('catalog:common.cancel')}
            </Button>
            <Button type='submit' disabled={!canSubmit || save.isPending}>
              {t('catalog:common.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
