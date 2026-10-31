import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldInput } from '@/features/common/components/field-input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { errorMessage, partApi } from '../api'
import {
  PartModel,
  type Category,
  type CategoryParameter,
} from '../model'

export function CategoryParametersPanel({
  category,
  permissions,
}: {
  category: Category
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canChange = hasPermission(permissions, 'part_category', 'change')
  const links = useQuery({
    queryKey: ['part', 'category-parameters', category.id],
    queryFn: () => partApi.categoryParameters(category.id),
  })
  const [remove, setRemove] = useState<CategoryParameter | null>(null)
  const save = useMutation({
    mutationFn: (body: { templateId: number; defaultValue?: string }) =>
      partApi.saveCategoryParameter(category.id, body),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['part', 'category-parameters', category.id],
      })
      toast.success('Category parameter saved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (row: CategoryParameter) =>
      partApi.removeCategoryParameter(category.id, row.id),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['part', 'category-parameters', category.id],
      })
      setRemove(null)
      toast.success('Category parameter removed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3'>
      <h3 className='font-medium'>Parameter defaults</h3>
      <p className='text-muted-foreground text-sm'>
        New parts in this category, including parts in child categories, receive
        these values. Unique templates are stored here only as a requirement;
        their default is left blank and is not copied.
      </p>
      {canChange && (
        <form
          className='grid gap-3 sm:grid-cols-[1fr_1fr_auto]'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
            save.mutate(
              PartModel.categoryParameterInput.parse({
                templateId: Number(form.get('templateId')),
                defaultValue: String(form.get('defaultValue') ?? ''),
              })
            )
            event.currentTarget.reset()
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        >
          <FieldInput
            field={{ name: 'templateId', label: 'Template ID', type: 'number', required: true, min: 1 }}
          />
          <FieldInput
            field={{ name: 'defaultValue', label: 'Default value', maxLength: 500 }}
          />
          <Button className='self-end' type='submit' disabled={save.isPending}>
            Link
          </Button>
        </form>
      )}
      {links.isPending && <p role='status'>Loading parameter defaults…</p>}
      {links.isError && <p role='alert'>{errorMessage(links.error)}</p>}
      {links.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Unique</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.template.name}
                  {row.template.units ? ` (${row.template.units})` : ''}
                </TableCell>
                <TableCell>{row.defaultValue}</TableCell>
                <TableCell>
                  {row.template.unique === 0
                    ? 'No'
                    : row.template.unique === 1
                      ? 'Model'
                      : 'Global'}
                </TableCell>
                <TableCell>
                  {canChange && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setRemove(row)}
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {links.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No parameter defaults yet.</TableCell>
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
        title='Remove category parameter'
        desc='Existing parts keep the values they already have.'
        confirmText='Remove'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (remove) deletion.mutate(remove)
        }}
      />
    </div>
  )
}
