import { useId, useState } from 'react'
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
import {
  RecipeSelect,
  type RecipeOption,
} from '@/features/recipes/components/recipe-select'
import { errorMessage, saleShortages } from '../api'
import { SalesPageModel, type SaleInput } from '../model'

function newRequestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `sale-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function SaleForm({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: SaleInput) => void
}) {
  const quantityId = useId()
  const [recipe, setRecipe] = useState<RecipeOption | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [requestKey, setRequestKey] = useState(newRequestKey)
  const [validationError, setValidationError] = useState<string | null>(null)
  const shortages = saleShortages(error)

  function chooseRecipe(next: RecipeOption | null) {
    if (next?.uuid !== recipe?.uuid) setRequestKey(newRequestKey())
    setRecipe(next)
  }

  function changeQuantity(value: string) {
    const nextIntent = Number(value)
    const currentIntent = Number(quantity)
    const sameIntent =
      value.trim() !== '' &&
      Number.isInteger(nextIntent) &&
      nextIntent > 0 &&
      nextIntent === currentIntent
    if (!sameIntent) setRequestKey(newRequestKey())
    setQuantity(value)
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>Record sale</SheetTitle>
          <SheetDescription>
            Records an active recipe and consumes its ingredient stock. The
            request key keeps a repeated submission from recording the sale
            twice.
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            if (!recipe) {
              setValidationError('Choose a recipe')
              return
            }
            try {
              const body = SalesPageModel.input.parse({
                recipeUuid: recipe.uuid,
                quantity: Number(quantity),
                requestKey,
              })
              setValidationError(null)
              onSubmit(body)
            } catch (caught) {
              setValidationError(errorMessage(caught))
            }
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <RecipeSelect
                label='Recipe'
                value={recipe}
                disabled={pending}
                onChange={chooseRecipe}
              />
              <div className='space-y-2'>
                <Label htmlFor={quantityId}>Quantity</Label>
                <Input
                  id={quantityId}
                  name='quantity'
                  type='number'
                  min={1}
                  step={1}
                  required
                  value={quantity}
                  onChange={(event) => changeQuantity(event.target.value)}
                />
              </div>
            </fieldset>
            {(validationError != null || error != null) && (
              <p role='alert' className='text-destructive'>
                {validationError ?? errorMessage(error)}
              </p>
            )}
            {shortages.length > 0 && (
              <div role='alert' className='space-y-1 text-sm'>
                <p className='font-medium'>Insufficient ingredient stock</p>
                <ul className='space-y-1'>
                  {shortages.map((shortage) => (
                    <li key={shortage.componentName}>
                      {shortage.componentName}: needed {shortage.required}
                      {shortage.componentUnits
                        ? ` ${shortage.componentUnits}`
                        : ''}
                      , available {shortage.available}, missing{' '}
                      {shortage.missing}
                    </li>
                  ))}
                </ul>
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
              Record sale
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
