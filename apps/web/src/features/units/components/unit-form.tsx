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
import { errorMessage, unitApi } from '../api'
import { invalidateUnitCatalog } from '../cache'
import { UnitsModel, type Unit, type UnitInput } from '../model'

export type UnitDraft = { mode: 'create' } | { mode: 'edit'; unit: Unit }

type UnitSaveRequest = {
  body: UnitInput
  uuid?: string
  version?: number
}

function draftKey(draft: UnitDraft) {
  return draft.mode === 'edit' ? `edit-${draft.unit.uuid}` : 'create'
}

export function UnitForm({
  draft,
  canSubmit,
  onOpenChange,
  onSaved,
}: {
  draft: UnitDraft | null
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (unit: Unit) => void
}) {
  const client = useQueryClient()
  const editing = draft?.mode === 'edit'
  const save = useMutation({
    mutationFn: (input: UnitSaveRequest) =>
      input.uuid === undefined
        ? unitApi.createUnit(input.body)
        : unitApi.updateUnit(input.uuid, {
            ...input.body,
            version: input.version ?? 0,
          }),
    onSuccess: async (saved) => {
      await invalidateUnitCatalog(client)
      toast.success(
        editing
          ? t('catalog:units.form.updatedToast')
          : t('catalog:units.form.createdToast')
      )
      onSaved?.(saved)
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Sheet open={draft != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>
            {editing
              ? t('catalog:units.form.editTitle')
              : t('catalog:units.form.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('catalog:units.form.description')}
          </SheetDescription>
        </SheetHeader>
        {draft && (
          <UnitFormBody
            key={draftKey(draft)}
            draft={draft}
            canSubmit={canSubmit}
            pending={save.isPending}
            onCancel={() => onOpenChange(false)}
            onSave={(input) => save.mutate(input)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function UnitFormBody({
  draft,
  canSubmit,
  pending,
  onCancel,
  onSave,
}: {
  draft: UnitDraft
  canSubmit: boolean
  pending: boolean
  onCancel: () => void
  onSave: (input: UnitSaveRequest) => void
}) {
  const unit = draft.mode === 'edit' ? draft.unit : null
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit || pending) return
        setError(null)
        try {
          const form = new FormData(event.currentTarget)
          const body = UnitsModel.unitInput.parse({
            name: String(form.get('name') ?? ''),
            code: String(form.get('code') ?? ''),
            active: form.has('active'),
            divisible: form.has('divisible'),
          })
          onSave(
            unit === null
              ? { body }
              : { body, uuid: unit.uuid, version: unit.version }
          )
        } catch (caught) {
          setError(errorMessage(caught))
        }
      }}
    >
      <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        <FieldInput
          field={{
            name: 'name',
            label: t('catalog:units.form.nameLabel'),
            required: true,
            maxLength: 100,
          }}
          value={unit?.name ?? ''}
          disabled={pending}
        />
        <FieldInput
          field={{
            name: 'code',
            label: t('catalog:units.form.codeLabel'),
            required: true,
            maxLength: 20,
          }}
          value={unit?.code ?? ''}
          disabled={pending}
        />
        <p className='text-xs text-muted-foreground'>
          {unit
            ? t('catalog:units.form.editHint')
            : t('catalog:units.form.createHint')}
        </p>
        <FlagInput
          name='active'
          label={t('catalog:units.form.activeLabel')}
          defaultChecked={unit ? unit.active : true}
          disabled={pending}
        />
        <div className='space-y-1'>
          <FlagInput
            name='divisible'
            label={t('catalog:units.form.divisibleLabel')}
            defaultChecked={unit ? unit.divisible : true}
            disabled={pending}
          />
          <p className='text-xs text-muted-foreground'>
            {t('catalog:units.form.divisibleHint')}
          </p>
        </div>
      </div>
      <SheetFooter className='border-t border-border'>
        <Button
          type='button'
          variant='outline'
          disabled={pending}
          onClick={onCancel}
        >
          {t('catalog:common.cancel')}
        </Button>
        <Button type='submit' disabled={!canSubmit || pending}>
          {t('catalog:common.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}
