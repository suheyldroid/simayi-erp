import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
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
import {
  ItemCategorySelect,
  type ItemCategoryOption,
} from '@/features/items/components/item-category-select'
import { errorMessage, itemCategoryApi } from '../api'
import {
  ItemCategoriesModel,
  type Category,
  type CategoryInput,
} from '../model'

export type CategoryDraft =
  | { mode: 'create' }
  | { mode: 'edit'; category: Category }
  | { mode: 'create-child'; parentUuid: string }

function draftTitle(draft: CategoryDraft) {
  if (draft.mode === 'edit') return t('catalog:itemCategories.form.editTitle')
  if (draft.mode === 'create-child')
    return t('catalog:itemCategories.form.createChildTitle')
  return t('catalog:itemCategories.form.createTitle')
}

function draftKey(draft: CategoryDraft) {
  if (draft.mode === 'edit') return `edit-${draft.category.uuid}`
  if (draft.mode === 'create-child') return `create-${draft.parentUuid}`
  return 'create'
}

export function CategoryForm({
  draft,
  canSubmit,
  onOpenChange,
  onSaved,
}: {
  draft: CategoryDraft | null
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (category: Category) => void
}) {
  const client = useQueryClient()
  const editing = draft?.mode === 'edit'
  const save = useMutation({
    mutationFn: (input: { body: CategoryInput; uuid?: string }) =>
      itemCategoryApi.saveCategory(input.body, input.uuid),
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: ['item-category'] })
      await client.invalidateQueries({ queryKey: ['item'] })
      toast.success(
        editing
          ? t('catalog:itemCategories.form.updatedToast')
          : t('catalog:itemCategories.form.createdToast')
      )
      onSaved?.(saved)
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Sheet open={draft != null} onOpenChange={onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>
            {draft
              ? draftTitle(draft)
              : t('catalog:itemCategories.form.fallbackTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('catalog:itemCategories.form.description')}
          </SheetDescription>
        </SheetHeader>
        {draft && (
          <CategoryFormBody
            key={draftKey(draft)}
            draft={draft}
            canSubmit={canSubmit}
            pending={save.isPending}
            onSave={(body, uuid) => save.mutate({ body, uuid })}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function CategoryFormBody({
  draft,
  canSubmit,
  pending,
  onSave,
}: {
  draft: CategoryDraft
  canSubmit: boolean
  pending: boolean
  onSave: (body: CategoryInput, uuid?: string) => void
}) {
  const category = draft.mode === 'edit' ? draft.category : null
  const fixedParentUuid =
    draft.mode === 'create-child' ? draft.parentUuid : null
  const parentLocked = draft.mode === 'create-child'
  const [parent, setParent] = useState<ItemCategoryOption | null>(null)
  const [parentUuid, setParentUuid] = useState<string | null>(
    category?.parentUuid ?? fixedParentUuid
  )
  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return
        try {
          const form = new FormData(event.currentTarget)
          onSave(
            ItemCategoriesModel.categoryInput.parse({
              name: String(form.get('name') ?? ''),
              description: String(form.get('description') ?? ''),
              parentUuid,
              structural: form.has('structural'),
            }),
            category?.uuid
          )
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }}
    >
      <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
        <FieldInput
          field={{
            name: 'name',
            label: t('catalog:itemCategories.form.nameLabel'),
            required: true,
            maxLength: 100,
          }}
          value={category?.name ?? ''}
        />
        <FieldInput
          field={{
            name: 'description',
            label: t('catalog:itemCategories.form.descriptionLabel'),
            type: 'textarea',
            maxLength: 250,
          }}
          value={category?.description ?? ''}
        />
        <ItemCategorySelect
          label={t('catalog:itemCategories.form.parentLabel')}
          value={parent}
          fallbackUuid={parent == null ? parentUuid : null}
          structural='any'
          excludeUuid={category?.uuid ?? null}
          disabled={parentLocked || pending}
          onChange={(next) => {
            setParent(next)
            setParentUuid(next?.uuid ?? null)
          }}
        />
        <FlagInput
          name='structural'
          label={t('catalog:itemCategories.form.structuralLabel')}
          defaultChecked={category?.structural ?? false}
        />
      </div>
      <SheetFooter className='border-t border-border'>
        <Button type='submit' disabled={!canSubmit || pending}>
          {t('catalog:common.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}
