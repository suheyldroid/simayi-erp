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
import { errorMessage, partApi } from '../api'
import { PartModel, type Category, type CategoryInput } from '../model'
import { CategoryParametersPanel } from './category-parameters-panel'

function CategoryBranch({
  category,
  selectedId,
  onSelect,
}: {
  category: Category
  selectedId: number | null
  onSelect: (category: Category) => void
}) {
  const [open, setOpen] = useState(false)
  const children = useQuery({
    queryKey: ['part', 'categories', 'children', category.id],
    queryFn: () => partApi.categories({ parentId: category.id }),
    enabled: open,
  })
  return (
    <>
      <TableRow
        data-state={selectedId === category.id ? 'selected' : undefined}
        onClick={() => onSelect(category)}
      >
        <TableCell>{category.pathstring}</TableCell>
        <TableCell>{category.structural ? 'Structural' : 'Parts'}</TableCell>
        <TableCell>{category.partCount}</TableCell>
        <TableCell>{category.childCount}</TableCell>
        <TableCell>
          {category.childCount > 0 && (
            <Button
              type='button'
              variant='outline'
              onClick={(event) => {
                event.stopPropagation()
                setOpen((value) => !value)
              }}
            >
              {open ? 'Hide' : 'Children'}
            </Button>
          )}
        </TableCell>
      </TableRow>
      {open &&
        children.data?.items.map((child) => (
          <CategoryBranch
            key={child.id}
            category={child}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

export function CategoriesPanel({
  permissions,
}: {
  permissions: EffectivePermissions | undefined
}) {
  const client = useQueryClient()
  const canAdd = hasPermission(permissions, 'part_category', 'add')
  const canChange = hasPermission(permissions, 'part_category', 'change')
  const canDelete = hasPermission(permissions, 'part_category', 'delete')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Category | null>(null)
  const [draft, setDraft] = useState<Category | null | undefined>(undefined)
  const [remove, setRemove] = useState<Category | null>(null)
  const categories = useQuery({
    queryKey: ['part', 'categories', search],
    queryFn: () =>
      partApi.categories({
        search,
        roots: search.trim() === '',
      }),
  })
  const save = useMutation({
    mutationFn: (input: { body: CategoryInput; id?: number }) =>
      partApi.saveCategory(input.body, input.id),
    onSuccess: async (category, variables) => {
      await client.invalidateQueries({ queryKey: ['part', 'categories'] })
      setSelected(category)
      setDraft(undefined)
      toast.success(variables.id ? 'Category updated' : 'Category created')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deletion = useMutation({
    mutationFn: partApi.removeCategory,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['part', 'categories'] })
      if (selected?.id === remove?.id) setSelected(null)
      setRemove(null)
      toast.success('Category deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Search categories'
          className='max-w-sm'
        />
        {canAdd && (
          <Button type='button' onClick={() => setDraft(null)}>
            New category
          </Button>
        )}
      </div>
      {categories.isPending && <p role='status'>Loading categories…</p>}
      {categories.isError && (
        <p role='alert'>{errorMessage(categories.error)}</p>
      )}
      {categories.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead>Children</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.data.items.map((category) =>
                search.trim() === '' ? (
                  <CategoryBranch
                    key={category.id}
                    category={category}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                  />
                ) : (
                  <TableRow
                    key={category.id}
                    data-state={
                      selected?.id === category.id ? 'selected' : undefined
                    }
                    onClick={() => setSelected(category)}
                  >
                    <TableCell>{category.pathstring}</TableCell>
                    <TableCell>
                      {category.structural ? 'Structural' : 'Parts'}
                    </TableCell>
                    <TableCell>{category.partCount}</TableCell>
                    <TableCell>{category.childCount}</TableCell>
                    <TableCell />
                  </TableRow>
                )
              )}
              {categories.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No categories yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {categories.data.total > categories.data.items.length && (
            <p className='text-muted-foreground text-sm'>
              Showing the first {categories.data.items.length} of{' '}
              {categories.data.total}. Refine the search to see the rest.
            </p>
          )}
        </>
      )}
      {selected && (
        <div className='space-y-4 rounded-lg border p-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <div>
              <h2 className='font-medium'>{selected.pathstring}</h2>
              <p className='text-muted-foreground text-sm'>
                ID {selected.id}
                {selected.defaultKeywords
                  ? ` · keywords ${selected.defaultKeywords}`
                  : ''}
                {selected.defaultLocation
                  ? ` · location ${selected.defaultLocation.pathstring}`
                  : ''}
              </p>
            </div>
            {canChange && (
              <Button type='button' variant='outline' onClick={() => setDraft(selected)}>
                Edit
              </Button>
            )}
            {canAdd && (
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  setDraft({
                    ...selected,
                    id: 0,
                    name: '',
                    description: '',
                    pathstring: '',
                    parentId: selected.id,
                    defaultLocationId: null,
                    defaultLocation: null,
                    defaultKeywords: null,
                    icon: null,
                    structural: false,
                    childCount: 0,
                    partCount: 0,
                  })
                }
              >
                Add child
              </Button>
            )}
            {canDelete && (
              <Button
                type='button'
                variant='outline'
                onClick={() => setRemove(selected)}
              >
                Delete
              </Button>
            )}
          </div>
          <CategoryParametersPanel
            category={selected}
            permissions={permissions}
          />
        </div>
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
              {draft?.id ? 'Edit category' : 'New category'}
            </DialogTitle>
            <DialogDescription>
              Structural categories organize the tree and cannot contain parts
              directly. A category cannot be moved under its own child.
            </DialogDescription>
          </DialogHeader>
          {draft !== undefined && (
            <form
              key={`${draft?.id ?? 'new'}-${draft?.parentId ?? 'root'}`}
              className='space-y-4'
              onSubmit={(event) => {
                event.preventDefault()
                if (draft === undefined) return
                try {
                const form = new FormData(event.currentTarget)
                const child = draft?.id === 0
                save.mutate({
                  id: draft && draft.id > 0 ? draft.id : undefined,
                  body: PartModel.categoryInput.parse({
                    name: String(form.get('name') ?? ''),
                    description: String(form.get('description') ?? ''),
                    parentId: child
                      ? String(draft?.parentId ?? '')
                      : String(form.get('parentId') ?? ''),
                    defaultLocationId: String(
                      form.get('defaultLocationId') ?? ''
                    ),
                    defaultKeywords: String(form.get('defaultKeywords') ?? ''),
                    icon: String(form.get('icon') ?? ''),
                    structural: form.has('structural'),
                  }),
                })
                } catch (error) {
                  toast.error(errorMessage(error))
                }
              }}
            >
              <FieldInput
                field={{ name: 'name', label: 'Name', required: true, maxLength: 100 }}
                value={draft && draft.id > 0 ? draft.name : ''}
              />
              <FieldInput
                field={{ name: 'description', label: 'Description', type: 'textarea', maxLength: 250 }}
                value={draft && draft.id > 0 ? draft.description : ''}
              />
              <FieldInput
                field={{ name: 'parentId', label: 'Parent category ID', type: 'number', min: 1 }}
                value={
                  draft == null
                    ? ''
                    : draft.parentId == null
                      ? ''
                      : String(draft.parentId)
                }
                disabled={draft?.id === 0}
              />
              <FieldInput
                field={{ name: 'defaultLocationId', label: 'Default location ID', type: 'number', min: 1 }}
                value={
                  draft?.defaultLocationId == null
                    ? ''
                    : String(draft.defaultLocationId)
                }
              />
              <FieldInput
                field={{ name: 'defaultKeywords', label: 'Default keywords', maxLength: 250 }}
                value={draft?.defaultKeywords ?? ''}
              />
              <FieldInput
                field={{ name: 'icon', label: 'Icon', maxLength: 100 }}
                value={draft?.icon ?? ''}
              />
              <FlagInput
                name='structural'
                label='Structural'
                defaultChecked={draft?.structural ?? false}
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
        title='Delete category'
        desc='Delete is refused while the category still has child categories or parts.'
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
