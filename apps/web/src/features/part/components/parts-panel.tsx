import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ManufacturerPartsPanel } from '@/features/company/components/manufacturer-parts-panel'
import { SupplierPartsPanel } from '@/features/company/components/supplier-parts-panel'
import { ItemsPanel } from '@/features/stock/components/items-panel'
import { TestTemplatesPanel } from '@/features/stock/components/test-templates-panel'
import {
  hasPermission,
  type EffectivePermissions,
} from '@/features/users/access-model'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, partApi } from '../api'
import { type Part } from '../model'
import { BomPanel } from './bom-panel'
import { ParametersPanel } from './parameters-panel'
import { PartForm, type PartDraft } from './part-form'
import { PriceBandsPanel } from './price-bands-panel'

function RelatedParts({
  title,
  empty,
  partId,
  kind,
  onSelect,
}: {
  title: string
  empty: string
  partId: number
  kind: 'variant' | 'revision'
  onSelect: (part: Part) => void
}) {
  const related = useQuery({
    queryKey: ['part', 'parts', kind, partId],
    queryFn: () =>
      partApi.parts({
        limit: 50,
        ...(kind === 'variant'
          ? { variantOfId: partId }
          : { revisionOfId: partId }),
      }),
  })
  return (
    <div className='space-y-2'>
      <h3 className='font-medium'>{title}</h3>
      {related.isPending && <p role='status'>Loading…</p>}
      {related.isError && <p role='alert'>{errorMessage(related.error)}</p>}
      {related.data && (
        <ul className='space-y-1 text-sm'>
          {related.data.items.map((part) => (
            <li key={part.id}>
              <Button
                type='button'
                variant='link'
                className='h-auto p-0'
                onClick={() => onSelect(part)}
              >
                {part.name}
                {part.revision ? ` · ${part.revision}` : ''}
                {part.ipn ? ` · ${part.ipn}` : ''}
              </Button>
            </li>
          ))}
          {related.data.items.length === 0 && <li>{empty}</li>}
          {related.data.total > related.data.items.length && (
            <li>Showing the first {related.data.items.length}.</li>
          )}
        </ul>
      )}
    </div>
  )
}

export function PartsPanel({
  permissions,
}: {
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'part', 'add')
  const canChange = hasPermission(permissions, 'part', 'change')
  const canDelete = hasPermission(permissions, 'part', 'delete')
  const canViewBom = hasPermission(permissions, 'bom', 'view')
  const canViewPrices = hasPermission(permissions, 'part', 'view')
  const canViewSupply = hasPermission(permissions, 'purchase_order', 'view')
  const canViewStock = hasPermission(permissions, 'stock', 'view')
  const canAddSupply = hasPermission(permissions, 'purchase_order', 'add')
  const canChangeSupply = hasPermission(permissions, 'purchase_order', 'change')
  const canDeleteSupply = hasPermission(permissions, 'purchase_order', 'delete')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Part | null>(null)
  const [draft, setDraft] = useState<PartDraft | null>(null)
  const [remove, setRemove] = useState(false)
  const parts = useQuery({
    queryKey: ['part', 'parts', page, search],
    queryFn: () => partApi.parts({ page, search }),
  })
  const deletion = useMutation({
    mutationFn: partApi.removePart,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'parts'] })
      setSelected(null)
      setRemove(false)
      toast.success('Part deleted')
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
          placeholder='Search name, IPN, revision, or keywords'
          className='max-w-sm'
        />
        {canAdd && (
          <Button
            type='button'
            onClick={() => setDraft({ mode: 'create', part: null })}
          >
            New part
          </Button>
        )}
      </div>
      {parts.isPending && <p role='status'>Loading parts…</p>}
      {parts.isError && <p role='alert'>{errorMessage(parts.error)}</p>}
      {parts.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>IPN</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.data.items.map((part) => (
                <TableRow
                  key={part.id}
                  data-state={selected?.id === part.id ? 'selected' : undefined}
                  onClick={() => setSelected(part)}
                >
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{part.ipn}</TableCell>
                  <TableCell>{part.revision}</TableCell>
                  <TableCell>{part.category?.pathstring}</TableCell>
                  <TableCell>
                    {part.isTemplate ? 'Template' : 'Part'}
                    {part.variantOfId != null ? ' · variant' : ''}
                    {part.revisionOfId != null ? ' · revision' : ''}
                    {part.active ? '' : ' · inactive'}
                    {part.locked ? ' · locked' : ''}
                  </TableCell>
                </TableRow>
              ))}
              {parts.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No parts yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PageControls
            page={page}
            hasNext={
              parts.data.offset + parts.data.items.length < parts.data.total
            }
            loading={parts.isFetching}
            onChange={setPage}
          />
        </>
      )}
      {selected && (
        <div className='space-y-4 rounded-lg border p-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h2 className='text-lg font-medium'>{selected.name}</h2>
              <p className='text-sm text-muted-foreground'>
                ID {selected.id}
                {selected.ipn ? ` · IPN ${selected.ipn}` : ''}
                {selected.revision ? ` · revision ${selected.revision}` : ''}
                {selected.category ? ` · ${selected.category.pathstring}` : ''}
                {` · version ${selected.version}`}
              </p>
              <p className='text-sm'>{selected.description}</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {canChange && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDraft({ mode: 'edit', part: selected })}
                >
                  Edit
                </Button>
              )}
              {canAdd && selected.isTemplate && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDraft({ mode: 'variant', part: selected })}
                >
                  New variant
                </Button>
              )}
              {canAdd && !selected.isTemplate && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDraft({ mode: 'revision', part: selected })}
                >
                  New revision
                </Button>
              )}
              {canDelete && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setRemove(true)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            {selected.isTemplate && (
              <RelatedParts
                title='Variants'
                empty='No variants yet.'
                partId={selected.id}
                kind='variant'
                onSelect={setSelected}
              />
            )}
            <RelatedParts
              title='Revisions'
              empty='No revisions yet.'
              partId={selected.id}
              kind='revision'
              onSelect={setSelected}
            />
          </div>
          {canViewSupply && (
            <>
              <ManufacturerPartsPanel
                partId={selected.id}
                canAdd={canAddSupply}
                canChange={canChangeSupply}
                canDelete={canDeleteSupply}
              />
              <SupplierPartsPanel
                partId={selected.id}
                canAdd={canAddSupply}
                canChange={canChangeSupply}
                canDelete={canDeleteSupply}
              />
            </>
          )}
          {canViewBom && (
            <BomPanel
              key={selected.id}
              part={selected}
              permissions={permissions}
            />
          )}
          {canViewPrices && (
            <>
              <PriceBandsPanel
                key={`${selected.id}-sell`}
                part={selected}
                kind='sell'
                permissions={permissions}
              />
              <PriceBandsPanel
                key={`${selected.id}-internal`}
                part={selected}
                kind='internal'
                permissions={permissions}
              />
            </>
          )}
          {canViewStock && (
            <ItemsPanel
              key={`stock-${selected.id}`}
              part={selected}
              permissions={permissions}
            />
          )}
          {selected.testable && (
            <TestTemplatesPanel
              key={`tests-${selected.id}`}
              part={selected}
              permissions={permissions}
            />
          )}
          <ParametersPanel
            part={selected}
            permissions={permissions}
            onVersion={(version) =>
              setSelected((current) =>
                current && current.id === selected.id
                  ? { ...current, version }
                  : current
              )
            }
          />
        </div>
      )}
      <PartForm
        draft={draft}
        onOpenChange={(open) => {
          if (!open) setDraft(null)
        }}
        onSaved={(part) => setSelected(part)}
      />
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title='Delete part'
        desc='Locked parts, templates that still have variants, and parts that still have revisions cannot be deleted. Parameters for this part are removed with it.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (selected) deletion.mutate(selected.id)
        }}
      />
    </div>
  )
}
