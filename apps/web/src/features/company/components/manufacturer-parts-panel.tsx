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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FieldInput } from '@/features/common/components/field-input'
import { errorMessage } from '../api'
import { supplyApi } from '../supply-api'
import {
  SupplyModel,
  type ManufacturerInput,
  type ManufacturerPart,
} from '../supply-model'

export function ManufacturerPartsPanel({
  partId,
  manufacturerId,
  canAdd,
  canChange,
  canDelete,
}: {
  partId?: number
  manufacturerId?: number
  canAdd: boolean
  canChange: boolean
  canDelete: boolean
}) {
  const client = useQueryClient()
  const rows = useQuery({
    queryKey: ['company', 'manufacturer-parts', partId, manufacturerId],
    queryFn: () => supplyApi.manufacturerParts({ partId, manufacturerId }),
  })
  const [draft, setDraft] = useState<ManufacturerPart | null | undefined>(
    undefined
  )
  const [remove, setRemove] = useState<ManufacturerPart | null>(null)
  const save = useMutation({
    mutationFn: (input: { id?: number; body: ManufacturerInput }) =>
      supplyApi.saveManufacturerPart(input.body, input.id),
    onSuccess: async (_row, variables) => {
      await client.invalidateQueries({ queryKey: ['company', 'manufacturer-parts'] })
      setDraft(undefined)
      toast.success(
        variables.id ? 'Manufacturer part updated' : 'Manufacturer part created'
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: supplyApi.removeManufacturerPart,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['company', 'manufacturer-parts'] })
      setRemove(null)
      toast.success('Manufacturer part deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-medium'>Manufacturer parts</h3>
        {canAdd && (
          <Button type='button' variant='outline' onClick={() => setDraft(null)}>
            Add MPN
          </Button>
        )}
      </div>
      {rows.isPending && <p role='status'>Loading manufacturer parts…</p>}
      {rows.isError && <p role='alert'>{errorMessage(rows.error)}</p>}
      {rows.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MPN</TableHead>
              <TableHead>{partId == null ? 'Part' : 'Manufacturer'}</TableHead>
              <TableHead>Description</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.mpn}</TableCell>
                <TableCell>
                  {partId == null ? row.part.name : row.manufacturer.name}
                </TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell className='space-x-2'>
                  {canChange && (
                    <Button type='button' variant='outline' onClick={() => setDraft(row)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button type='button' variant='outline' onClick={() => setRemove(row)}>
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No manufacturer parts yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
              {draft ? 'Edit manufacturer part' : 'New manufacturer part'}
            </DialogTitle>
            <DialogDescription>
              The company must be a manufacturer. The MPN is unique for that
              manufacturer and internal part.
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
                    body: SupplyModel.manufacturerInput.parse({
                      partId: partId ?? Number(form.get('partId')),
                      manufacturerId:
                        manufacturerId ?? Number(form.get('manufacturerId')),
                      mpn: String(form.get('mpn') ?? ''),
                      description: String(form.get('description') ?? ''),
                      link: String(form.get('link') ?? ''),
                    }),
                  })
                } catch (error) {
                  toast.error(errorMessage(error))
                }
              }}
            >
              {partId == null && (
                <FieldInput
                  field={{ name: 'partId', label: 'Part ID', type: 'number', required: true, min: 1 }}
                  value={draft ? String(draft.partId) : ''}
                />
              )}
              {manufacturerId == null && (
                <FieldInput
                  field={{ name: 'manufacturerId', label: 'Manufacturer ID', type: 'number', required: true, min: 1 }}
                  value={draft ? String(draft.manufacturerId) : ''}
                />
              )}
              <FieldInput
                field={{ name: 'mpn', label: 'MPN', required: true, maxLength: 100 }}
                value={draft?.mpn ?? ''}
              />
              <FieldInput
                field={{ name: 'description', label: 'Description', maxLength: 250 }}
                value={draft?.description ?? ''}
              />
              <FieldInput
                field={{ name: 'link', label: 'Link', maxLength: 2000 }}
                value={draft?.link ?? ''}
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
        title='Delete manufacturer part'
        desc='Delete is refused while a supplier part still uses this MPN.'
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
