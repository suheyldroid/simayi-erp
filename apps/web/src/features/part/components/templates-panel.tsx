import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FieldInput } from '@/features/common/components/field-input'
import { FlagInput } from '@/features/company/components/flag-input'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, partApi } from '../api'
import {
  PartModel,
  type ParameterTemplate,
  type TemplateInput,
} from '../model'

const uniqueLabel = (value: number) =>
  value === 1 ? 'Unique for model' : value === 2 ? 'Globally unique' : 'None'

export function TemplatesPanel({
  permissions,
}: {
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'part', 'add')
  const canChange = hasPermission(permissions, 'part', 'change')
  const canDelete = hasPermission(permissions, 'part', 'delete')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<ParameterTemplate | null | undefined>(
    undefined
  )
  const [remove, setRemove] = useState<ParameterTemplate | null>(null)
  const templates = useQuery({
    queryKey: ['part', 'templates', page, search],
    queryFn: () => partApi.templates(page, search),
  })
  const save = useMutation({
    mutationFn: (input: { body: TemplateInput; id?: number }) =>
      partApi.saveTemplate(input.body, input.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'templates'] })
      setDraft(undefined)
      toast.success(draft ? 'Template updated' : 'Template created')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: partApi.removeTemplate,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'templates'] })
      setRemove(null)
      toast.success('Template deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
          placeholder='Search templates'
          className='max-w-sm'
        />
        {canAdd && (
          <Button type='button' onClick={() => setDraft(null)}>
            New template
          </Button>
        )}
      </div>
      {templates.isPending && <p role='status'>Loading templates…</p>}
      {templates.isError && <p role='alert'>{errorMessage(templates.error)}</p>}
      {templates.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Unique</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.data.items.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>{template.id}</TableCell>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>{template.units}</TableCell>
                  <TableCell>{uniqueLabel(template.unique)}</TableCell>
                  <TableCell>{template.enabled ? 'Yes' : 'No'}</TableCell>
                  <TableCell className='space-x-2'>
                    {canChange && (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setDraft(template)}
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setRemove(template)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {templates.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>No parameter templates yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            hasNext={
              templates.data.offset + templates.data.items.length <
              templates.data.total
            }
            loading={templates.isFetching}
            onChange={setPage}
          />
        </>
      )}
      <Dialog
        open={draft !== undefined}
        onOpenChange={(open) => {
          if (!open) setDraft(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {draft ? 'Edit parameter template' : 'New parameter template'}
            </DialogTitle>
            <DialogDescription>
              Checkbox values must be true or false. Choices are a
              comma-separated list. Uniqueness is case-insensitive. Leave the
              model type empty to allow the template on any record; set it to
              the part model type to restrict it to parts.
            </DialogDescription>
          </DialogHeader>
          {draft !== undefined && (
            <form
              key={draft?.id ?? 'new'}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                try {
                save.mutate({
                  id: draft?.id,
                  body: PartModel.templateInput.parse({
                    name: String(form.get('name') ?? ''),
                    units: String(form.get('units') ?? ''),
                    description: String(form.get('description') ?? ''),
                    choices: String(form.get('choices') ?? ''),
                    unique: Number(form.get('unique') ?? 0),
                    modelTypeId: String(form.get('modelTypeId') ?? ''),
                    checkbox: form.has('checkbox'),
                    enabled: form.has('enabled'),
                  }),
                })
                } catch (error) {
                  toast.error(errorMessage(error))
                }
              }}
            >
              <FieldInput
                field={{ name: 'name', label: 'Name', required: true, maxLength: 100 }}
                value={draft?.name ?? ''}
              />
              <FieldInput
                field={{ name: 'units', label: 'Units', maxLength: 25 }}
                value={draft?.units ?? ''}
              />
              <FieldInput
                field={{ name: 'description', label: 'Description', maxLength: 250 }}
                value={draft?.description ?? ''}
              />
              <FieldInput
                field={{ name: 'choices', label: 'Choices', maxLength: 5000 }}
                value={draft?.choices ?? ''}
              />
              <FieldInput
                field={{ name: 'modelTypeId', label: 'Model type ID', type: 'number', min: 1 }}
                value={draft?.modelTypeId == null ? '' : String(draft.modelTypeId)}
              />
              <div className='space-y-2'>
                <Label htmlFor='parameter-unique'>Uniqueness</Label>
                <select
                  id='parameter-unique'
                  name='unique'
                  defaultValue={String(draft?.unique ?? 0)}
                  className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                >
                  <option value='0'>No uniqueness</option>
                  <option value='1'>Unique for the same model type</option>
                  <option value='2'>Globally unique</option>
                </select>
              </div>
              <FlagInput
                name='checkbox'
                label='Checkbox'
                defaultChecked={draft?.checkbox ?? false}
              />
              <FlagInput
                name='enabled'
                label='Enabled'
                defaultChecked={draft?.enabled ?? true}
              />
              <DialogFooter>
                <Button type='submit' disabled={save.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={remove != null}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title='Delete parameter template'
        desc='Parameters and category links that use this template are deleted with it.'
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
