import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldInput } from '@/features/common/components/field-input'
import { FlagInput } from '@/features/company/components/flag-input'
import { type Part } from '@/features/part/model'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { errorMessage, stockApi } from '../api'
import { StockModel, type TemplateInput, type TestTemplate } from '../model'

export function TestTemplatesPanel({
  part,
  permissions,
}: {
  part: Part
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'part', 'add')
  const canChange = hasPermission(permissions, 'part', 'change')
  const canDelete = hasPermission(permissions, 'part', 'delete')
  const templates = useQuery({
    queryKey: ['part', 'tests', part.id],
    queryFn: () => stockApi.testTemplates(part.id),
  })
  const [editing, setEditing] = useState<TestTemplate | null>(null)
  const [remove, setRemove] = useState<TestTemplate | null>(null)
  const save = useMutation({
    mutationFn: (input: { id?: number; body: TemplateInput }) =>
      stockApi.saveTestTemplate(part.id, input.body, input.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'tests', part.id] })
      setEditing(null)
      toast.success('Test template saved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (id: number) => stockApi.removeTestTemplate(part.id, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'tests', part.id] })
      setRemove(null)
      toast.success('Test template deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const showForm = part.testable && (editing ? canChange : canAdd)
  return (
    <div className='space-y-3'>
      <h3 className='font-medium'>Test templates</h3>
      <p className='text-sm text-muted-foreground'>
        Templates belong to this part and are shown on its variants. The test
        key is generated from the name. Deleting a template also deletes its
        recorded results.
      </p>
      {!part.testable && (
        <p className='text-sm text-muted-foreground'>
          Mark the part as testable before adding templates. Inherited templates
          are still listed.
        </p>
      )}
      {showForm && (
        <form
          key={editing?.id ?? 'new'}
          className='grid gap-3'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
              save.mutate({
                id: editing?.id,
                body: StockModel.templateInput.parse({
                  testName: String(form.get('testName') ?? ''),
                  description: String(form.get('description') ?? ''),
                  enabled: form.get('enabled') === 'on',
                  required: form.get('required') === 'on',
                  requiresValue: form.get('requiresValue') === 'on',
                  requiresAttachment: form.get('requiresAttachment') === 'on',
                  choices: String(form.get('choices') ?? ''),
                }),
              })
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          <div className='grid gap-3 sm:grid-cols-2'>
            <FieldInput
              field={{
                name: 'testName',
                label: 'Test name',
                required: true,
                maxLength: 100,
              }}
              value={editing?.testName ?? ''}
            />
            <FieldInput
              field={{
                name: 'description',
                label: 'Description',
                maxLength: 100,
              }}
              value={editing?.description ?? ''}
            />
            <FieldInput
              field={{ name: 'choices', label: 'Choices', maxLength: 5000 }}
              value={editing?.choices ?? ''}
            />
          </div>
          <div className='flex flex-wrap gap-4'>
            <FlagInput
              name='enabled'
              label='Enabled'
              defaultChecked={editing?.enabled ?? true}
            />
            <FlagInput
              name='required'
              label='Required'
              defaultChecked={editing?.required ?? true}
            />
            <FlagInput
              name='requiresValue'
              label='Requires value'
              defaultChecked={editing?.requiresValue ?? false}
            />
            <FlagInput
              name='requiresAttachment'
              label='Requires attachment path'
              defaultChecked={editing?.requiresAttachment ?? false}
            />
          </div>
          <div className='flex gap-2'>
            <Button type='submit' disabled={save.isPending}>
              {editing ? 'Save template' : 'Add template'}
            </Button>
            {editing && (
              <Button
                type='button'
                variant='outline'
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {templates.isPending && <p role='status'>Loading test templates…</p>}
      {templates.isError && <p role='alert'>{errorMessage(templates.error)}</p>}
      {templates.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.testName}
                  {row.editable ? '' : ' · inherited'}
                </TableCell>
                <TableCell>{row.key}</TableCell>
                <TableCell>
                  {[
                    row.enabled ? '' : 'Disabled',
                    row.required ? 'Required' : '',
                    row.requiresValue ? 'Value' : '',
                    row.requiresAttachment ? 'Attachment' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </TableCell>
                <TableCell className='space-x-2'>
                  {canChange && row.editable && part.testable && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setEditing(row)}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && row.editable && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setRemove(row)}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {templates.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No test templates yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <ConfirmDialog
        open={remove != null}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title='Delete test template'
        desc='Results recorded against this template are deleted with it.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (remove) deletion.mutate(remove.id)
        }}
      />
    </div>
  )
}
