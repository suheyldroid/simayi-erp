import { useRef, useState } from 'react'
import { XIcon } from 'lucide-react'
import { locale, t } from '@/lib/i18n'
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
import { RecipeSelect, type RecipeOption } from './recipe-select'

type DraftRow = {
  key: string
  kind: 'item' | 'recipe'
  item: ItemOption | null
  recipe: RecipeOption | null
  quantity: string
  note: string
  noteOpen: boolean
}

type RowErrors = {
  selection?: string
  quantity?: string
}

type FieldErrors = {
  name?: string
  code?: string
  price?: string
  description?: string
  ingredients?: string
  form?: string
  rows: Record<string, RowErrors>
}

const EMPTY_ERRORS: FieldErrors = { rows: {} }

let rowSequence = 0

function createRow(
  kind: DraftRow['kind'],
  ingredient?: RecipeDetail['ingredients'][number]
): DraftRow {
  rowSequence += 1
  return {
    key: `recipe-row-${rowSequence}`,
    kind,
    item: ingredient?.kind === 'item' ? ingredient.item : null,
    recipe:
      ingredient?.kind === 'recipe'
        ? {
            uuid: ingredient.recipe.uuid,
            name: ingredient.recipe.name,
            code: ingredient.recipe.code,
            active: ingredient.recipe.active,
            sellable: ingredient.recipe.sellable,
            version: ingredient.recipe.version,
            ingredientCount: ingredient.recipe.ingredientCount,
            sellingPrice: ingredient.recipe.sellingPrice,
            priceCurrencyCode: ingredient.recipe.priceCurrencyCode,
          }
        : null,
    quantity: ingredient?.quantity ?? '',
    note: ingredient?.note ?? '',
    noteOpen: (ingredient?.note ?? '') !== '',
  }
}

export type RecipeDraft = {
  name: string
  code: string
  description: string
  sellingPrice: string | null
  active: boolean
  /** Direct-sale flag; a sellable recipe must carry a price. */
  sellable: boolean
  ingredients: RecipeCreateInput['ingredients']
}

export function RecipeSheet({
  recipe,
  variant = 'create',
  showActive = true,
  sourceLabel,
  pending,
  error,
  onClose,
  onReload,
  onSubmit,
}: {
  /** Existing record used to prefill the form; absent for a new recipe. */
  recipe?: RecipeDetail
  /** create = company template or branch-local recipe; edit = content update; customize = branch copy. */
  variant?: 'create' | 'edit' | 'customize'
  /** False when the scope gates activity elsewhere (company gate or branch activation). */
  showActive?: boolean
  /** Explains the source/version this sheet reads or copies. */
  sourceLabel?: string
  pending: boolean
  error: unknown
  onClose: () => void
  onReload?: () => void
  onSubmit: (draft: RecipeDraft) => void
}) {
  const editing = recipe !== undefined
  const [name, setName] = useState(recipe?.name ?? '')
  const [code, setCode] = useState(recipe?.code ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [sellingPrice, setSellingPrice] = useState(recipe?.sellingPrice ?? '')
  const [active, setActive] = useState(recipe?.active ?? true)
  const [sellable, setSellable] = useState(recipe?.sellable ?? false)
  const [rows, setRows] = useState<DraftRow[]>(() =>
    recipe
      ? recipe.ingredients.map((ingredient) =>
          createRow(ingredient.kind, ingredient)
        )
      : []
  )
  // Optional metadata stays out of the way unless it already holds a value.
  const [detailsOpen, setDetailsOpen] = useState(
    () => (recipe?.description ?? '') !== '' || recipe?.active === false
  )
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS)
  const bodyRef = useRef<HTMLDivElement>(null)
  const addActionsRef = useRef<HTMLDivElement>(null)

  const clearFieldError = (field: 'name' | 'code' | 'price' | 'description') =>
    setErrors((current) => {
      if (current[field] === undefined) return current
      if (field === 'name') return { ...current, name: undefined }
      if (field === 'code') return { ...current, code: undefined }
      if (field === 'price') return { ...current, price: undefined }
      return { ...current, description: undefined }
    })

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
    setErrors((current) => {
      const rowErrors = current.rows[key]
      if (rowErrors === undefined) return current
      const nextRowErrors: RowErrors = { ...rowErrors }
      if (patch.item !== undefined || patch.recipe !== undefined)
        delete nextRowErrors.selection
      if (patch.quantity !== undefined) delete nextRowErrors.quantity
      const nextRows = { ...current.rows }
      if (
        nextRowErrors.selection === undefined &&
        nextRowErrors.quantity === undefined
      ) {
        delete nextRows[key]
      } else {
        nextRows[key] = nextRowErrors
      }
      return { ...current, rows: nextRows }
    })
  }

  // Focus the added/neighboring row's combobox without opening its popover.
  const focusRow = (key?: string) => {
    requestAnimationFrame(() => {
      const rowSelector =
        key === undefined
          ? null
          : bodyRef.current?.querySelector<HTMLElement>(
              `[data-row-key="${key}"] [role="combobox"]`
            )
      const target =
        rowSelector ??
        addActionsRef.current?.querySelector<HTMLElement>('button')
      if (!target) return
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center' })
    })
  }

  const addRow = (kind: DraftRow['kind']) => {
    const row = createRow(kind)
    setRows((current) => [...current, row])
    setErrors((current) =>
      current.ingredients === undefined
        ? current
        : { ...current, ingredients: undefined }
    )
    focusRow(row.key)
  }

  const focusFirstInvalid = (noRows: boolean) => {
    requestAnimationFrame(() => {
      const target =
        bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        (noRows
          ? addActionsRef.current?.querySelector<HTMLElement>('button')
          : null)
      if (!target) return
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center' })
    })
  }

  const submitDraft = () => {
    const nextErrors: FieldErrors = { rows: {} }
    const addRowError = (
      key: string,
      field: keyof RowErrors,
      message: string
    ) => {
      const rowErrors = nextErrors.rows[key] ?? {}
      if (rowErrors[field] === undefined) rowErrors[field] = message
      nextErrors.rows[key] = rowErrors
    }
    const ingredients: RecipeCreateInput['ingredients'] = []
    const seenItems = new Set<string>()
    const seenRecipes = new Set<string>()
    rows.forEach((row) => {
      if (row.kind === 'item') {
        if (row.item === null) {
          addRowError(
            row.key,
            'selection',
            t('catalog:recipes.sheet.errors.chooseItem')
          )
          return
        }
        if (!row.item.units) {
          addRowError(
            row.key,
            'selection',
            t('catalog:recipes.sheet.errors.itemNoUnit', {
              name: row.item.name,
            })
          )
          return
        }
        if (seenItems.has(row.item.uuid)) {
          addRowError(
            row.key,
            'selection',
            t('catalog:recipes.sheet.errors.duplicateItem', {
              name: row.item.name,
            })
          )
        } else {
          seenItems.add(row.item.uuid)
        }
        const parsed = RecipesModel.ingredientInput.safeParse({
          kind: 'item',
          itemUuid: row.item.uuid,
          quantity: row.quantity,
          note: row.note,
        })
        if (parsed.success) {
          ingredients.push(parsed.data)
        } else {
          const issue = parsed.error.issues[0]
          addRowError(
            row.key,
            issue?.path[0] === 'quantity' ? 'quantity' : 'selection',
            issue?.message ?? t('catalog:recipes.sheet.errors.invalidValue')
          )
        }
        return
      }
      if (row.recipe === null) {
        addRowError(
          row.key,
          'selection',
          t('catalog:recipes.sheet.errors.chooseRecipe')
        )
        return
      }
      if (row.recipe.uuid === recipe?.uuid) {
        addRowError(
          row.key,
          'selection',
          t('catalog:recipes.sheet.errors.selfRecipe', {
            name: row.recipe.name,
          })
        )
      } else if (seenRecipes.has(row.recipe.uuid)) {
        addRowError(
          row.key,
          'selection',
          t('catalog:recipes.sheet.errors.duplicateRecipe', {
            name: row.recipe.name,
          })
        )
      } else if (!row.recipe.active) {
        addRowError(
          row.key,
          'selection',
          t('catalog:recipes.sheet.errors.recipeInactive', {
            name: row.recipe.name,
          })
        )
        return
      }
      seenRecipes.add(row.recipe.uuid)
      const parsed = RecipesModel.ingredientInput.safeParse({
        kind: 'recipe',
        recipeUuid: row.recipe.uuid,
        quantity: row.quantity,
        note: row.note,
      })
      if (parsed.success) {
        ingredients.push(parsed.data)
      } else {
        const issue = parsed.error.issues[0]
        addRowError(
          row.key,
          issue?.path[0] === 'quantity' ? 'quantity' : 'selection',
          issue?.message ?? t('catalog:recipes.sheet.errors.invalidValue')
        )
      }
    })
    if (rows.length === 0) {
      nextErrors.ingredients = t(
        'catalog:recipes.sheet.errors.ingredientsRequired'
      )
    } else if (rows.length > 500) {
      nextErrors.ingredients = t('catalog:recipes.sheet.errors.ingredientsMax')
    }
    // Still parse so name and price errors surface together with row errors;
    // ingredient issues are already reported against their row.
    const parsed = RecipesModel.createInput.safeParse({
      name,
      code: code.trim() === '' ? null : code.trim(),
      description,
      active,
      sellable,
      sellingPrice: sellingPrice.trim() === '' ? null : sellingPrice,
      ingredients,
    })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [head] = issue.path
        if (head === 'name') {
          nextErrors.name ??= t('catalog:recipes.sheet.errors.nameRequired')
        } else if (head === 'code') {
          nextErrors.code ??= t('catalog:recipes.sheet.errors.codeLength')
        } else if (head === 'sellingPrice') {
          nextErrors.price ??= issue.message
        } else if (head === 'description') {
          nextErrors.description ??= t(
            'catalog:recipes.sheet.errors.descriptionLength'
          )
          setDetailsOpen(true)
        } else if (head !== 'ingredients') {
          nextErrors.form ??= issue.message
        }
      }
    }
    const hasErrors =
      nextErrors.name !== undefined ||
      nextErrors.code !== undefined ||
      nextErrors.price !== undefined ||
      nextErrors.description !== undefined ||
      nextErrors.ingredients !== undefined ||
      nextErrors.form !== undefined ||
      Object.keys(nextErrors.rows).length > 0
    setErrors(nextErrors)
    if (hasErrors || !parsed.success) {
      focusFirstInvalid(rows.length === 0)
      return
    }
    onSubmit({
      name: parsed.data.name,
      code: parsed.data.code ?? '',
      description: parsed.data.description ?? '',
      sellingPrice: parsed.data.sellingPrice ?? null,
      active: parsed.data.active ?? active,
      sellable: parsed.data.sellable ?? sellable,
      ingredients: parsed.data.ingredients,
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
          <SheetTitle>
            {variant === 'customize'
              ? t('catalog:recipes.sheet.customizeTitle')
              : editing
                ? t('catalog:recipes.sheet.editTitle')
                : t('catalog:recipes.sheet.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {variant === 'customize'
              ? t('catalog:recipes.sheet.customizeDescription')
              : t('catalog:recipes.sheet.createDescription')}
          </SheetDescription>
          {sourceLabel !== undefined && (
            <p className='text-xs text-muted-foreground'>{sourceLabel}</p>
          )}
        </SheetHeader>
        <form
          noValidate
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            submitDraft()
          }}
        >
          <div
            ref={bodyRef}
            className='min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4'
          >
            <fieldset disabled={pending} className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='recipe-name'>
                  {t('catalog:recipes.sheet.nameLabel')}
                </Label>
                <Input
                  id='recipe-name'
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    clearFieldError('name')
                  }}
                  maxLength={100}
                  required
                  placeholder={t('catalog:recipes.sheet.namePlaceholder')}
                  aria-invalid={errors.name === undefined ? undefined : true}
                  aria-describedby={
                    errors.name === undefined ? undefined : 'recipe-name-error'
                  }
                />
                {errors.name !== undefined && (
                  <p
                    id='recipe-name-error'
                    className='text-xs text-destructive'
                  >
                    {errors.name}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='recipe-code'>
                  {t('catalog:recipes.sheet.codeLabel')}
                </Label>
                <Input
                  id='recipe-code'
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    clearFieldError('code')
                  }}
                  maxLength={100}
                  placeholder={t('catalog:recipes.sheet.codePlaceholder')}
                  aria-invalid={errors.code === undefined ? undefined : true}
                  aria-describedby={
                    errors.code === undefined
                      ? 'recipe-code-hint'
                      : 'recipe-code-hint recipe-code-error'
                  }
                />
                <p
                  id='recipe-code-hint'
                  className='text-xs text-muted-foreground'
                >
                  {t('catalog:recipes.sheet.codeHint')}
                </p>
                {errors.code !== undefined && (
                  <p
                    id='recipe-code-error'
                    className='text-xs text-destructive'
                  >
                    {errors.code}
                  </p>
                )}
              </div>

              <section className='space-y-3'>
                <div className='flex flex-wrap items-baseline justify-between gap-2'>
                  <h3 className='text-sm font-medium'>
                    {t('catalog:recipes.sheet.ingredientsHeading')}
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    {t('catalog:recipes.sheet.rowsCount', {
                      n: rows.length.toLocaleString(locale),
                    })}
                  </p>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {t('catalog:recipes.sheet.quantitiesNote', {
                    target:
                      name.trim() === ''
                        ? t('catalog:recipes.sheet.thisRecipe')
                        : name.trim(),
                  })}
                </p>
                <div ref={addActionsRef} className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={pending || rows.length >= 500}
                    onClick={() => addRow('item')}
                  >
                    {t('catalog:recipes.sheet.addItem')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={pending || rows.length >= 500}
                    onClick={() => addRow('recipe')}
                  >
                    {t('catalog:recipes.sheet.addRecipe')}
                  </Button>
                </div>
                {errors.ingredients !== undefined && (
                  <p role='alert' className='text-sm text-destructive'>
                    {errors.ingredients}
                  </p>
                )}
                {rows.length === 0 ? (
                  <div className='rounded-md border border-dashed border-border p-4'>
                    <p className='text-sm font-medium'>
                      {t('catalog:recipes.sheet.noIngredientsTitle')}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {t('catalog:recipes.sheet.noIngredientsDescription')}
                    </p>
                  </div>
                ) : (
                  <ul className='space-y-3'>
                    {rows.map((row, index) => {
                      const itemExcludes = rows.flatMap((other) =>
                        other.key !== row.key &&
                        other.kind === 'item' &&
                        other.item
                          ? [other.item.uuid]
                          : []
                      )
                      const recipeExcludes = rows.flatMap((other) =>
                        other.key !== row.key &&
                        other.kind === 'recipe' &&
                        other.recipe
                          ? [other.recipe.uuid]
                          : []
                      )
                      if (recipe) recipeExcludes.push(recipe.uuid)
                      return (
                        <IngredientRow
                          key={row.key}
                          row={row}
                          index={index}
                          pending={pending}
                          itemExcludes={itemExcludes}
                          recipeExcludes={recipeExcludes}
                          errors={errors.rows[row.key]}
                          onChange={(patch) => updateRow(row.key, patch)}
                          onNoteOpenChange={(open) =>
                            setRows((current) =>
                              current.map((candidate) =>
                                candidate.key === row.key
                                  ? { ...candidate, noteOpen: open }
                                  : candidate
                              )
                            )
                          }
                          onRemove={() => {
                            const nextRow: DraftRow | undefined =
                              index + 1 < rows.length
                                ? rows[index + 1]
                                : rows[index - 1]
                            setRows((current) =>
                              current.filter(
                                (candidate) => candidate.key !== row.key
                              )
                            )
                            focusRow(nextRow?.key)
                          }}
                        />
                      )
                    })}
                  </ul>
                )}
              </section>

              <div className='space-y-2 rounded-md border border-border p-3'>
                <FlagInput
                  name='sellable'
                  label={t('catalog:recipes.sheet.sellableLabel')}
                  checked={sellable}
                  onChange={(next) => {
                    setSellable(next)
                    if (!next) clearFieldError('price')
                  }}
                  disabled={pending}
                />
                <p className='text-xs text-muted-foreground'>
                  {t('catalog:recipes.sheet.sellableHint')}
                </p>
              </div>

              {sellable ? (
                <div className='space-y-2'>
                  <Label htmlFor='recipe-price'>
                    {t('catalog:recipes.sheet.priceLabel')}
                  </Label>
                  <Input
                    id='recipe-price'
                    value={sellingPrice}
                    onChange={(event) => {
                      setSellingPrice(event.target.value)
                      clearFieldError('price')
                    }}
                    inputMode='decimal'
                    maxLength={20}
                    required
                    placeholder={t('catalog:recipes.sheet.pricePlaceholder')}
                    aria-invalid={errors.price === undefined ? undefined : true}
                    aria-describedby={
                      errors.price === undefined
                        ? 'recipe-price-hint'
                        : 'recipe-price-hint recipe-price-error'
                    }
                  />
                  <p
                    id='recipe-price-hint'
                    className='text-xs text-muted-foreground'
                  >
                    {recipe?.priceCurrencyCode
                      ? t('catalog:recipes.sheet.priceHintStored', {
                          code: recipe.priceCurrencyCode,
                        })
                      : t('catalog:recipes.sheet.priceHintFixed')}
                    {t('catalog:recipes.sheet.priceHintRest')}
                  </p>
                  {errors.price !== undefined && (
                    <p
                      id='recipe-price-error'
                      className='text-xs text-destructive'
                    >
                      {errors.price}
                    </p>
                  )}
                </div>
              ) : (
                sellingPrice.trim() !== '' && (
                  <p className='text-xs text-muted-foreground'>
                    {t('catalog:recipes.sheet.priceRetained', {
                      price: `${sellingPrice} ${
                        recipe?.priceCurrencyCode ?? ''
                      }`.trim(),
                    })}
                  </p>
                )
              )}

              <details
                open={detailsOpen}
                onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
                className='rounded-md border border-border p-3'
              >
                <summary className='w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'>
                  {t('catalog:recipes.sheet.detailsSummary')}
                </summary>
                <div className='mt-3 space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='recipe-description'>
                      {t('catalog:recipes.sheet.descriptionLabel')}
                    </Label>
                    <Textarea
                      id='recipe-description'
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value)
                        clearFieldError('description')
                      }}
                      maxLength={250}
                      rows={3}
                      placeholder={t(
                        'catalog:recipes.sheet.descriptionPlaceholder'
                      )}
                      aria-invalid={
                        errors.description === undefined ? undefined : true
                      }
                      aria-describedby={
                        errors.description === undefined
                          ? undefined
                          : 'recipe-description-error'
                      }
                    />
                    {errors.description !== undefined && (
                      <p
                        id='recipe-description-error'
                        className='text-xs text-destructive'
                      >
                        {errors.description}
                      </p>
                    )}
                  </div>
                  {showActive ? (
                    <FlagInput
                      name='active'
                      label={t('catalog:recipes.sheet.activeLabel')}
                      checked={active}
                      onChange={setActive}
                      disabled={pending}
                    />
                  ) : (
                    <p className='text-xs text-muted-foreground'>
                      {sourceLabel === undefined
                        ? t('catalog:recipes.sheet.activityExternal')
                        : t('catalog:recipes.sheet.activityNotPart')}
                    </p>
                  )}
                </div>
              </details>
            </fieldset>
            {(errors.form !== undefined || error != null) && (
              <div className='space-y-2'>
                <p role='alert' className='text-sm text-destructive'>
                  {errors.form ?? errorMessage(error)}
                </p>
                {onReload != null && error != null && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={onReload}
                    disabled={pending}
                  >
                    {t('catalog:recipes.sheet.discardReload')}
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
              {t('catalog:common.cancel')}
            </Button>
            <Button type='submit' disabled={pending}>
              {pending
                ? t('catalog:common.saving')
                : variant === 'customize'
                  ? t('catalog:recipes.sheet.createCustomization')
                  : editing
                    ? t('catalog:recipes.sheet.saveRecipe')
                    : t('catalog:recipes.sheet.createRecipe')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function IngredientRow({
  row,
  index,
  pending,
  itemExcludes,
  recipeExcludes,
  errors,
  onChange,
  onNoteOpenChange,
  onRemove,
}: {
  row: DraftRow
  index: number
  pending: boolean
  itemExcludes: string[]
  recipeExcludes: string[]
  errors?: RowErrors
  onChange: (patch: Partial<DraftRow>) => void
  onNoteOpenChange: (open: boolean) => void
  onRemove: () => void
}) {
  const quantityId = `ingredient-quantity-${row.key}`
  const noteId = `ingredient-note-${row.key}`
  const selectionErrorId = `ingredient-selection-error-${row.key}`
  const quantityErrorId = `ingredient-quantity-error-${row.key}`
  const selectedName = row.kind === 'item' ? row.item?.name : row.recipe?.name
  const unit =
    row.kind === 'recipe'
      ? t('catalog:recipes.sheet.unitRecipe')
      : row.item === null
        ? ''
        : row.item.units || t('catalog:recipes.sheet.unitNoUnit')
  return (
    <li
      data-row-key={row.key}
      className='space-y-3 rounded-md border border-border p-3'
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground'>
            {row.kind === 'item'
              ? t('catalog:recipes.sheet.kindItem')
              : t('catalog:recipes.sheet.kindRecipe')}
          </span>
          <p className='min-w-0 truncate text-sm text-muted-foreground'>
            {t('catalog:recipes.sheet.ingredientIndex', { index: index + 1 })}
            {selectedName ? ` · ${selectedName}` : ''}
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          disabled={pending}
          aria-label={
            selectedName
              ? t('catalog:recipes.sheet.removeIngredientNamed', {
                  index: index + 1,
                  name: selectedName,
                })
              : t('catalog:recipes.sheet.removeIngredient', {
                  index: index + 1,
                })
          }
          onClick={onRemove}
        >
          <XIcon className='size-4' />
        </Button>
      </div>
      <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]'>
        <div className='min-w-0 space-y-1'>
          {row.kind === 'item' ? (
            <ItemSelect
              label={t('catalog:recipes.sheet.itemSelectLabel', {
                index: index + 1,
              })}
              value={row.item}
              excludeIds={itemExcludes}
              disabled={pending}
              invalid={errors?.selection !== undefined}
              describedBy={
                errors?.selection === undefined ? undefined : selectionErrorId
              }
              onChange={(item) => onChange({ item })}
            />
          ) : (
            <RecipeSelect
              label={t('catalog:recipes.sheet.recipeSelectLabel', {
                index: index + 1,
              })}
              value={row.recipe}
              excludeIds={recipeExcludes}
              disabled={pending}
              showPrice={false}
              invalid={errors?.selection !== undefined}
              describedBy={
                errors?.selection === undefined ? undefined : selectionErrorId
              }
              onChange={(recipe) => onChange({ recipe })}
            />
          )}
          {row.kind === 'recipe' &&
            row.recipe !== null &&
            !row.recipe.active && (
              <p className='text-xs text-destructive'>
                {t('catalog:recipes.sheet.errors.recipeInactive', {
                  name: row.recipe.name,
                })}
              </p>
            )}
          {errors?.selection !== undefined && (
            <p id={selectionErrorId} className='text-xs text-destructive'>
              {errors.selection}
            </p>
          )}
        </div>
        <div className='space-y-2'>
          <Label htmlFor={quantityId}>
            {t('catalog:recipes.sheet.quantityLabel')}
            {unit === '' ? null : <span className='sr-only'> ({unit})</span>}
          </Label>
          <div className='relative'>
            <Input
              id={quantityId}
              value={row.quantity}
              onChange={(event) => onChange({ quantity: event.target.value })}
              inputMode='decimal'
              maxLength={20}
              required
              placeholder={t('catalog:recipes.sheet.quantityPlaceholder')}
              className='pe-24'
              aria-invalid={errors?.quantity === undefined ? undefined : true}
              aria-describedby={
                errors?.quantity === undefined ? undefined : quantityErrorId
              }
            />
            <span
              aria-hidden='true'
              className='pointer-events-none absolute inset-y-0 end-3 flex max-w-20 items-center truncate text-xs text-muted-foreground'
            >
              {unit}
            </span>
          </div>
          {errors?.quantity !== undefined && (
            <p id={quantityErrorId} className='text-xs text-destructive'>
              {errors.quantity}
            </p>
          )}
        </div>
      </div>
      <details
        open={row.noteOpen}
        onToggle={(event) => onNoteOpenChange(event.currentTarget.open)}
      >
        <summary className='w-fit cursor-pointer rounded-sm text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'>
          {t('catalog:recipes.sheet.noteSummary')}
        </summary>
        <div className='mt-2 space-y-2'>
          <Label htmlFor={noteId}>
            {t('catalog:recipes.sheet.noteLabel', { index: index + 1 })}
          </Label>
          <Input
            id={noteId}
            value={row.note}
            onChange={(event) => onChange({ note: event.target.value })}
            maxLength={500}
            placeholder={t('catalog:recipes.sheet.notePlaceholder')}
          />
        </div>
      </details>
    </li>
  )
}
