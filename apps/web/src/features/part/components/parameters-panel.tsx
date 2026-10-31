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
  type ParameterInput,
  type Part,
  type PartParameter,
} from '../model'

export function ParametersPanel({
  part,
  permissions,
  onVersion,
}: {
  part: Part
  permissions: EffectivePermissions | undefined
  onVersion: (version: number) => void
}) {
  const client = useQueryClient()
  const canChange = hasPermission(permissions, 'part', 'change')
  const parameters = useQuery({
    queryKey: ['part', 'parameters', part.id],
    queryFn: () => partApi.parameters(part.id),
  })
  const [remove, setRemove] = useState<PartParameter | null>(null)
  const save = useMutation({
    mutationFn: (body: ParameterInput) =>
      partApi.saveParameter(part.id, body),
    onSuccess: async (row) => {
      await client.invalidateQueries({ queryKey: ['part'] })
      onVersion(row.partVersion)
      toast.success('Parameter saved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (row: PartParameter) =>
      partApi.removeParameter(part.id, row.id, part.version),
    onSuccess: async (result) => {
      onVersion(result.partVersion)
      await client.invalidateQueries({ queryKey: ['part'] })
      setRemove(null)
      toast.success('Parameter removed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3'>
      <h3 className='font-medium'>Parameters</h3>
      {part.locked && (
        <p className='text-muted-foreground text-sm'>
          Unlock the part before changing its parameters.
        </p>
      )}
      {canChange && !part.locked && (
        <form
          className='grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]'
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
            save.mutate(
              PartModel.parameterInput.parse({
                templateId: Number(form.get('templateId')),
                data: String(form.get('data') ?? ''),
                note: String(form.get('note') ?? ''),
                version: part.version,
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
            field={{ name: 'data', label: 'Value', required: true, maxLength: 500 }}
          />
          <FieldInput field={{ name: 'note', label: 'Note', maxLength: 500 }} />
          <Button className='self-end' type='submit' disabled={save.isPending}>
            Add
          </Button>
        </form>
      )}
      {parameters.isPending && <p role='status'>Loading parameters…</p>}
      {parameters.isError && (
        <p role='alert'>{errorMessage(parameters.error)}</p>
      )}
      {parameters.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Note</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.template.name}
                  {row.template.units ? ` (${row.template.units})` : ''}
                </TableCell>
                <TableCell>{row.data}</TableCell>
                <TableCell>{row.note}</TableCell>
                <TableCell>
                  {canChange && !part.locked && (
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
            {parameters.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No parameters yet.</TableCell>
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
        title='Remove parameter'
        desc='This value will be removed from the part.'
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
