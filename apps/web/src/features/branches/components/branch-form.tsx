import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
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
import { branchesApi, errorMessage } from '../api'
import { BranchesModel, type Branch, type BranchInput } from '../model'

export type BranchDraft = { mode: 'create' } | { mode: 'edit'; branch: Branch }

export function BranchForm({
  draft,
  canSubmit,
  onOpenChange,
  onSaved,
}: {
  draft: BranchDraft | null
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (branch: Branch) => void
}) {
  const client = useQueryClient()
  const router = useRouter()
  const editing = draft?.mode === 'edit'
  const save = useMutation({
    mutationFn: (input: { body: BranchInput; branch?: Branch }) =>
      input.branch
        ? branchesApi.update(input.branch.uuid, {
            ...input.body,
            version: input.branch.version,
          })
        : branchesApi.create(input.body),
    onSuccess: async (saved) => {
      await client.invalidateQueries({
        queryKey: ['branch', organizationCacheScope()],
      })
      await router.invalidate()
      toast.success(
        editing
          ? t('catalog:branches.form.updatedToast')
          : t('catalog:branches.form.createdToast')
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
            {draft?.mode === 'edit'
              ? t('catalog:branches.form.editTitle')
              : t('catalog:branches.form.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('catalog:branches.form.description')}
          </SheetDescription>
        </SheetHeader>
        {draft && (
          <BranchFormBody
            key={draft.mode === 'edit' ? `edit-${draft.branch.uuid}` : 'create'}
            draft={draft}
            canSubmit={canSubmit}
            pending={save.isPending}
            onCancel={() => onOpenChange(false)}
            onSave={(body, branch) => save.mutate({ body, branch })}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function BranchFormBody({
  draft,
  canSubmit,
  pending,
  onCancel,
  onSave,
}: {
  draft: BranchDraft
  canSubmit: boolean
  pending: boolean
  onCancel: () => void
  onSave: (body: BranchInput, branch?: Branch) => void
}) {
  const branch = draft.mode === 'edit' ? draft.branch : null
  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return
        try {
          const form = new FormData(event.currentTarget)
          onSave(
            BranchesModel.input.parse({
              name: String(form.get('name') ?? ''),
              description: String(form.get('description') ?? ''),
            }),
            branch ?? undefined
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
            label: t('catalog:branches.form.nameLabel'),
            required: true,
            maxLength: 100,
          }}
          value={branch?.name ?? ''}
          disabled={pending}
        />
        <FieldInput
          field={{
            name: 'description',
            label: t('catalog:branches.form.descriptionLabel'),
            type: 'textarea',
            maxLength: 250,
          }}
          value={branch?.description ?? ''}
          disabled={pending}
        />
      </div>
      <SheetFooter>
        <Button
          type='button'
          variant='outline'
          disabled={pending}
          onClick={onCancel}
        >
          {t('catalog:common.cancel')}
        </Button>
        <Button type='submit' disabled={pending || !canSubmit}>
          {pending
            ? t('catalog:common.saving')
            : branch
              ? t('catalog:branches.form.save')
              : t('catalog:branches.form.create')}
        </Button>
      </SheetFooter>
    </form>
  )
}
