import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
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
  type BomInput,
  type BomLine,
  type BomSubstitute,
  type Part,
} from '../model'

type PartChoice = { id: number; name: string; ipn: string | null }

function PartPicker({
  label,
  exclude,
  componentsOnly,
  selected,
  onSelect,
}: {
  label: string
  exclude: number[]
  componentsOnly: boolean
  selected: PartChoice | null
  onSelect: (part: PartChoice | null) => void
}) {
  const [search, setSearch] = useState('')
  const results = useQuery({
    queryKey: ['part', 'parts', 'picker', search],
    queryFn: () => partApi.parts({ search, limit: 8 }),
    enabled: search.trim().length > 0,
  })
  const matches = (results.data?.items ?? []).filter(
    (item) => !exclude.includes(item.id) && (!componentsOnly || item.component)
  )
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder='Search name, IPN, or revision'
      />
      {selected && (
        <p className='text-sm'>
          Selected: {selected.name}
          {selected.ipn ? ` · ${selected.ipn}` : ''} (ID {selected.id})
        </p>
      )}
      {results.isError && <p role='alert'>{errorMessage(results.error)}</p>}
      {search.trim().length > 0 && (
        <ul className='space-y-1'>
          {matches.map((item) => (
            <li key={item.id}>
              <Button
                type='button'
                variant='link'
                className='h-auto p-0'
                onClick={() => {
                  onSelect({ id: item.id, name: item.name, ipn: item.ipn })
                  setSearch('')
                }}
              >
                {item.name}
                {item.ipn ? ` · ${item.ipn}` : ''}
              </Button>
            </li>
          ))}
          {results.isSuccess && matches.length === 0 && (
            <li className='text-sm text-muted-foreground'>
              No matching parts.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function BomForm({
  part,
  line,
  pending,
  onSubmit,
  onCancel,
}: {
  part: Part
  line: BomLine | null
  pending: boolean
  onSubmit: (body: BomInput) => void
  onCancel: () => void
}) {
  const [component, setComponent] = useState<PartChoice | null>(
    line?.subPart ?? null
  )
  return (
    <form
      className='grid gap-3'
      onSubmit={(event) => {
        event.preventDefault()
        if (!component) {
          toast.error('Choose a component part')
          return
        }
        const form = new FormData(event.currentTarget)
        const rounding = String(form.get('roundingMultiple') ?? '').trim()
        try {
          onSubmit(
            PartModel.bomInput.parse({
              subPartId: component.id,
              rawAmount: String(form.get('rawAmount') ?? ''),
              reference: String(form.get('reference') ?? ''),
              note: String(form.get('note') ?? ''),
              setupQuantity: String(form.get('setupQuantity') ?? '') || '0',
              attrition: String(form.get('attrition') ?? '') || '0',
              roundingMultiple: rounding === '' ? null : rounding,
              pieceCount: Number(form.get('pieceCount') || 1),
              optional: form.get('optional') === 'on',
              consumable: form.get('consumable') === 'on',
              inherited: form.get('inherited') === 'on',
              allowVariants: form.get('allowVariants') === 'on',
            })
          )
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }}
    >
      <PartPicker
        label='Component'
        exclude={[part.id]}
        componentsOnly
        selected={component}
        onSelect={setComponent}
      />
      <div className='grid gap-3 sm:grid-cols-2'>
        <FieldInput
          field={{ name: 'rawAmount', label: 'Quantity', required: true }}
          value={line?.rawAmount ?? ''}
        />
        <FieldInput
          field={{ name: 'reference', label: 'Reference', maxLength: 5000 }}
          value={line?.reference ?? ''}
        />
        <FieldInput
          field={{ name: 'setupQuantity', label: 'Setup quantity' }}
          value={line?.setupQuantity ?? '0'}
        />
        <FieldInput
          field={{ name: 'attrition', label: 'Attrition %' }}
          value={line?.attrition ?? '0'}
        />
        <FieldInput
          field={{ name: 'roundingMultiple', label: 'Rounding multiple' }}
          value={line?.roundingMultiple ?? ''}
        />
        <FieldInput
          field={{
            name: 'pieceCount',
            label: 'Piece count',
            type: 'number',
            min: 1,
            required: true,
          }}
          value={String(line?.pieceCount ?? 1)}
        />
        <FieldInput
          field={{ name: 'note', label: 'Note', maxLength: 500 }}
          value={line?.note ?? ''}
        />
      </div>
      <div className='flex flex-wrap gap-4'>
        <FlagInput
          name='optional'
          label='Optional'
          defaultChecked={line?.optional ?? false}
        />
        <FlagInput
          name='consumable'
          label='Consumable'
          defaultChecked={line?.consumable ?? false}
        />
        <FlagInput
          name='allowVariants'
          label='Allow variants'
          defaultChecked={line?.allowVariants ?? false}
        />
        {part.isTemplate && (
          <FlagInput
            name='inherited'
            label='Inherited by variants'
            defaultChecked={line?.inherited ?? false}
          />
        )}
      </div>
      <div className='flex gap-2'>
        <Button type='submit' disabled={pending}>
          {line ? 'Save line' : 'Add line'}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function BomPanel({
  part,
  permissions,
}: {
  part: Part
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'bom', 'add')
  const canChange = hasPermission(permissions, 'bom', 'change')
  const canDelete = hasPermission(permissions, 'bom', 'delete')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<BomLine | null | undefined>(undefined)
  const [removeLine, setRemoveLine] = useState<BomLine | null>(null)
  const [removeSubstitute, setRemoveSubstitute] = useState<{
    line: BomLine
    substitute: BomSubstitute
  } | null>(null)
  const bom = useQuery({
    queryKey: ['part', 'bom', part.id, page, search],
    queryFn: () => partApi.bom(part.id, page, search),
  })
  const save = useMutation({
    mutationFn: (input: { id?: number; body: BomInput }) =>
      partApi.saveBom(part.id, input.body, input.id),
    onSuccess: async (_row, variables) => {
      await client.invalidateQueries({ queryKey: ['part', 'bom', part.id] })
      setDraft(undefined)
      toast.success(variables.id ? 'BOM line updated' : 'BOM line added')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: (id: number) => partApi.removeBom(part.id, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'bom', part.id] })
      setRemoveLine(null)
      toast.success('BOM line deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const validation = useMutation({
    mutationFn: () => partApi.validateBom(part.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'bom', part.id] })
      await client.invalidateQueries({ queryKey: ['part', 'parts'] })
      toast.success('BOM validated')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const addSubstitute = useMutation({
    mutationFn: (input: { bomItemId: number; partId: number }) =>
      partApi.addSubstitute(part.id, input.bomItemId, input.partId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'bom', part.id] })
      toast.success('Substitute added')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deleteSubstitute = useMutation({
    mutationFn: (input: { bomItemId: number; id: number }) =>
      partApi.removeSubstitute(part.id, input.bomItemId, input.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'bom', part.id] })
      setRemoveSubstitute(null)
      toast.success('Substitute removed')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const isAssembly = Boolean(bom.data?.assembly)
  const canEditLines = isAssembly && !part.locked
  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h3 className='font-medium'>Bill of materials</h3>
        <div className='flex flex-wrap gap-2'>
          {canChange && isAssembly && (
            <Button
              type='button'
              variant='outline'
              disabled={validation.isPending}
              onClick={() => validation.mutate()}
            >
              Validate BOM
            </Button>
          )}
          {canAdd && canEditLines && draft === undefined && (
            <Button
              type='button'
              variant='outline'
              onClick={() => setDraft(null)}
            >
              Add line
            </Button>
          )}
        </div>
      </div>
      <p className='text-sm text-muted-foreground'>
        Only assemblies can own BOM lines, and each component must be marked as
        a component. Inherited lines belong to the template and stay read-only
        on variants. Changing a line clears validation.
      </p>
      {part.locked && (
        <p className='text-sm text-muted-foreground'>
          Unlock the part before changing its bill of materials.
        </p>
      )}
      {bom.data && !isAssembly && (
        <p className='text-sm text-muted-foreground'>
          This part is not an assembly. Inherited lines from its template are
          listed when it is a variant.
        </p>
      )}
      {bom.data && (
        <p className='text-sm'>
          {bom.data.bomValidated
            ? `Validated${bom.data.bomCheckedDate ? ` on ${bom.data.bomCheckedDate}` : ''}`
            : 'Not validated'}
        </p>
      )}
      <Input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(0)
        }}
        placeholder='Search reference, note, or component'
        className='max-w-sm'
      />
      {draft !== undefined && (
        <BomForm
          key={draft?.id ?? 'new'}
          part={part}
          line={draft}
          pending={save.isPending}
          onCancel={() => setDraft(undefined)}
          onSubmit={(body) => save.mutate({ id: draft?.id, body })}
        />
      )}
      {bom.isPending && <p role='status'>Loading bill of materials…</p>}
      {bom.isError && <p role='alert'>{errorMessage(bom.error)}</p>}
      {bom.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.data.items.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>{line.subPart.name}</div>
                    <div className='text-xs text-muted-foreground'>
                      {line.subPart.ipn ? `${line.subPart.ipn} · ` : ''}
                      {line.editable ? 'This part' : 'Inherited'}
                      {line.note ? ` · ${line.note}` : ''}
                    </div>
                    {line.substitutes.length > 0 && (
                      <ul className='mt-1 space-y-1 text-xs'>
                        {line.substitutes.map((item) => (
                          <li key={item.id}>
                            Substitute: {item.part.name}
                            {canDelete && line.editable && canEditLines && (
                              <Button
                                type='button'
                                variant='link'
                                className='h-auto px-2 py-0'
                                onClick={() =>
                                  setRemoveSubstitute({
                                    line,
                                    substitute: item,
                                  })
                                }
                              >
                                Remove
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canAdd && line.editable && canEditLines && (
                      <SubstituteForm
                        assemblyId={part.id}
                        componentId={line.subPartId}
                        pending={addSubstitute.isPending}
                        onAdd={(partId) =>
                          addSubstitute
                            .mutateAsync({ bomItemId: line.id, partId })
                            .then(() => undefined)
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {line.rawAmount}
                    {line.attrition !== '0'
                      ? ` · attrition ${line.attrition}%`
                      : ''}
                  </TableCell>
                  <TableCell>{line.reference}</TableCell>
                  <TableCell>
                    {[
                      line.optional ? 'Optional' : '',
                      line.consumable ? 'Consumable' : '',
                      line.inherited ? 'Inherited' : '',
                      line.allowVariants ? 'Variants' : '',
                      line.validated ? 'Checked' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </TableCell>
                  <TableCell className='space-x-2'>
                    {canChange && line.editable && canEditLines && (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setDraft(line)}
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && line.editable && canEditLines && (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setRemoveLine(line)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {bom.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No BOM lines yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            hasNext={bom.data.offset + bom.data.items.length < bom.data.total}
            loading={bom.isFetching}
            onChange={setPage}
          />
        </>
      )}
      <ConfirmDialog
        open={removeLine != null}
        onOpenChange={(open) => {
          if (!open) setRemoveLine(null)
        }}
        title='Delete BOM line'
        desc='Substitutes on this line are removed with it. Validation is cleared for this assembly and for variants that inherited the line.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (removeLine) deletion.mutate(removeLine.id)
        }}
      />
      <ConfirmDialog
        open={removeSubstitute != null}
        onOpenChange={(open) => {
          if (!open) setRemoveSubstitute(null)
        }}
        title='Remove substitute'
        desc='This alternative part will be removed from the BOM line.'
        confirmText='Remove'
        destructive
        isLoading={deleteSubstitute.isPending}
        handleConfirm={() => {
          if (removeSubstitute)
            deleteSubstitute.mutate({
              bomItemId: removeSubstitute.line.id,
              id: removeSubstitute.substitute.id,
            })
        }}
      />
    </div>
  )
}

function SubstituteForm({
  assemblyId,
  componentId,
  pending,
  onAdd,
}: {
  assemblyId: number
  componentId: number
  pending: boolean
  onAdd: (partId: number) => Promise<void>
}) {
  const [selected, setSelected] = useState<PartChoice | null>(null)
  return (
    <div className='mt-2 space-y-2'>
      <PartPicker
        label='Substitute'
        exclude={[assemblyId, componentId]}
        componentsOnly={false}
        selected={selected}
        onSelect={setSelected}
      />
      <Button
        type='button'
        variant='outline'
        disabled={pending || selected == null}
        onClick={() => {
          if (!selected) return
          const partId = selected.id
          void onAdd(partId).then(
            () => setSelected(null),
            () => undefined
          )
        }}
      >
        Add substitute
      </Button>
    </div>
  )
}
