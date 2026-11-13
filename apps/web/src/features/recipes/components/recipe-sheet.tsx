import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { FlagInput } from '@/components/flag-input'
import {
  ItemSelect,
  type ItemOption,
} from '@/features/items/components/item-select'
import { errorMessage } from '../api'
import {
  RecipesModel,
  type RecipeCreateInput,
  type RecipeDetail,
} from '../model'

type DraftRow = {
  key: string
  item: ItemOption | null
  quantity: string
  note: string
}

let rowSequence = 0

function createRow(ingredient?: RecipeDetail['ingredients'][number]): DraftRow {
  rowSequence += 1
  return {
    key: `recipe-row-${rowSequence}`,
    item: ingredient?.item ?? null,
    quantity: ingredient?.quantity ?? '',
    note: ingredient?.note ?? '',
  }
}

export function RecipeSheet({
  recipe,
  pending,
  error,
  onClose,
  onReload,
  onSubmit,
}: {
  recipe?: RecipeDetail
  pending: boolean
  error: unknown
  onClose: () => void
  onReload?: () => void
  onSubmit: (body: RecipeCreateInput) => void
}) {
  const editing = recipe !== undefined
  const [name, setName] = useState(recipe?.name ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [active, setActive] = useState(recipe?.active ?? true)
  const [rows, setRows] = useState<DraftRow[]>(() =>
    recipe && recipe.ingredients.length > 0
      ? recipe.ingredients.map((ingredient) => createRow(ingredient))
      : [createRow()]
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  const buildPayload = () => {
    if (rows.length === 0) throw new Error('Add at least one ingredient.')
    if (rows.length > 500)
      throw new Error('A recipe supports up to 500 ingredients.')
    const seen = new Set<string>()
    const ingredients = rows.map((row, index) => {
      if (!row.item)
        throw new Error(`Choose an ingredient item for row ${index + 1}.`)
      if (!row.item.units)
        throw new Error(
          `${row.item.name} has no unit assigned. Assign a unit in Items before using it in a recipe.`
        )
      if (seen.has(row.item.uuid))
        throw new Error(`${row.item.name} is listed more than once.`)
      seen.add(row.item.uuid)
      const parsed = RecipesModel.ingredientInput.safeParse({
        itemUuid: row.item.uuid,
        quantity: row.quantity,
        note: row.note,
      })
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new Error(
          `Ingredient ${index + 1} (${row.item.name}): ${
            issue?.message ?? 'Invalid value.'
          }`
        )
      }
      return parsed.data
    })
    return RecipesModel.createInput.parse({
      name,
      description,
      active,
      ingredients,
    })
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit recipe' : 'New recipe'}</SheetTitle>
          <SheetDescription>
            A recipe lists its ingredient items and the quantity of each one
            needed for a single recipe unit. Selling the recipe deducts each
            quantity multiplied by the sold quantity from stock.
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            try {
              const body = buildPayload()
              setValidationError(null)
              onSubmit(body)
            } catch (caught) {
              setValidationError(errorMessage(caught))
            }
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='recipe-name'>Name</Label>
                <Input
                  id='recipe-name'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder='e.g. Cheeseburger'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='recipe-description'>Description</Label>
                <Textarea
                  id='recipe-description'
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={250}
                  rows={3}
                  placeholder='Optional description'
                />
              </div>
              <FlagInput
                name='active'
                label='Active recipe'
                checked={active}
                onChange={setActive}
                disabled={pending}
              />
              <div className='space-y-3'>
                <h3 className='text-sm font-medium'>Ingredients</h3>
                <p className='text-sm text-muted-foreground'>
                  Choose an active, stockable item for each ingredient. The same
                  item can appear only once per recipe.
                </p>
                {rows.map((row, index) => {
                  const exclude = rows.flatMap((other) =>
                    other.key !== row.key && other.item ? [other.item.uuid] : []
                  )
                  return (
                    <div
                      key={row.key}
                      className='space-y-3 rounded-md border border-border p-3'
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <p className='text-sm font-medium'>
                          Ingredient {index + 1}
                        </p>
                        <Button
                          type='button'
                          variant='outline'
                          disabled={pending || rows.length <= 1}
                          onClick={() =>
                            setRows((current) =>
                              current.filter(
                                (candidate) => candidate.key !== row.key
                              )
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                      <ItemSelect
                        label={`Ingredient item ${index + 1}`}
                        value={row.item}
                        excludeIds={exclude}
                        disabled={pending}
                        onChange={(item) => updateRow(row.key, { item })}
                      />
                      <div className='grid gap-3 sm:grid-cols-2'>
                        <div className='space-y-2'>
                          <Label htmlFor={`quantity-${row.key}`}>
                            Quantity per recipe
                          </Label>
                          <Input
                            id={`quantity-${row.key}`}
                            value={row.quantity}
                            onChange={(event) =>
                              updateRow(row.key, {
                                quantity: event.target.value,
                              })
                            }
                            inputMode='decimal'
                            maxLength={20}
                            required
                            placeholder='e.g. 0.25 or 0,25'
                            aria-describedby={`quantity-hint-${row.key}`}
                          />
                          <p
                            id={`quantity-hint-${row.key}`}
                            className='text-xs text-muted-foreground'
                          >
                            {row.item
                              ? `In ${row.item.units || 'an unresolved unit'} per one recipe unit.`
                              : 'Choose an item to see its units.'}{' '}
                            Decimals accept a comma or a dot, up to 5 places.
                          </p>
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor={`note-${row.key}`}>Note</Label>
                          <Input
                            id={`note-${row.key}`}
                            value={row.note}
                            onChange={(event) =>
                              updateRow(row.key, { note: event.target.value })
                            }
                            maxLength={500}
                            placeholder='Optional note'
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    disabled={pending || rows.length >= 500}
                    onClick={() =>
                      setRows((current) => [...current, createRow()])
                    }
                  >
                    Add ingredient
                  </Button>
                  <p className='text-sm text-muted-foreground'>
                    {rows.length} of 500 ingredients
                  </p>
                </div>
              </div>
            </fieldset>
            {(validationError != null || error != null) && (
              <div className='space-y-2'>
                <p role='alert' className='text-sm text-destructive'>
                  {validationError ?? errorMessage(error)}
                </p>
                {onReload != null && error != null && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={onReload}
                    disabled={pending}
                  >
                    Discard changes and reload
                  </Button>
                )}
              </div>
            )}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={pending}>
              {pending ? 'Saving…' : editing ? 'Save recipe' : 'Create recipe'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
