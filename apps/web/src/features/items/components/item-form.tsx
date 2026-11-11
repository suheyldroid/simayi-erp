import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { errorMessage, itemApi } from '../api'
import { itemImageApi, itemImagePrefix } from '../image-api'
import { ItemsModel, canonicalStock, type Item, type ItemInput } from '../model'
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
      await client.invalidateQueries({ queryKey: ['item-category'] })
      toast.success(editing ? 'Item updated' : 'Item created')
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
          <SheetTitle>{editing ? 'Edit item' : 'New item'}</SheetTitle>
          <SheetDescription>
            Items are physical stock materials. Each item keeps one stock
            balance with a recorded history of every change.
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
            try {
              const body = ItemsModel.itemInput.parse({
                name: String(form.get('name') ?? ''),
                description: String(form.get('description') ?? ''),
                image: image ?? '',
                categoryUuid: categoryUuid ?? '',
                units: String(form.get('units') ?? ''),
                ipn: String(form.get('ipn') ?? ''),
                defaultExpiry: Number(form.get('defaultExpiry') ?? 0),
                minimumStock: String(form.get('minimumStock') ?? '0'),
                stock: String(form.get('stock') ?? '0'),
                active: form.has('active'),
                ...(editing && source ? { version: source.version } : {}),
              })
              // A metadata-only edit must not record a redundant stock count.
              if (
                editing &&
                source &&
                body.stock !== undefined &&
                canonicalStock(body.stock) === canonicalStock(source.stock)
              ) {
                delete body.stock
              }
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
                  label: 'Name',
                  required: true,
                  maxLength: 100,
                }}
                value={text(source, source?.name)}
              />
              <FieldInput
                field={{ name: 'ipn', label: 'IPN', maxLength: 100 }}
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
              <FieldInput
                field={{ name: 'units', label: 'Units', maxLength: 20 }}
                value={text(source, source?.units)}
              />
              <FieldInput
                field={{
                  name: 'minimumStock',
                  label: 'Minimum stock',
                  pattern: '\\d+(\\.\\d{1,6})?',
                }}
                value={source?.minimumStock ?? '0'}
              />
              <FieldInput
                field={{
                  name: 'stock',
                  label: editing ? 'Stock' : 'Initial stock',
                  required: true,
                  pattern: '\\d*[.,]\\d{1,5}|\\d+',
                }}
                value={source ? source.stock : '0'}
              />
              <FieldInput
                field={{
                  name: 'defaultExpiry',
                  label: 'Default expiry days',
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
              alt='Item image preview'
              onChange={(next) => {
                setImage(next.image)
                setFile(next.file)
              }}
            />
            <FieldInput
              field={{
                name: 'description',
                label: 'Description',
                type: 'textarea',
                maxLength: 250,
              }}
              value={text(source, source?.description)}
            />
            <FlagInput
              name='active'
              label='Active'
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
              Cancel
            </Button>
            <Button type='submit' disabled={!canSubmit || save.isPending}>
              Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
