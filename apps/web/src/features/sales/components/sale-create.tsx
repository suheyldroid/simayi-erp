import { useId, useState } from 'react'
import { t } from '@/lib/i18n'
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
import { SalesPageModel, type SaleInput, type SalesChannel } from '../model'
import { ChannelSelect } from './channel-select'

function newRequestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `sale-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function SaleForm({
  branchName,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  branchName: string
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: SaleInput) => void
}) {
  const quantityId = useId()
  const [recipe, setRecipe] = useState<RecipeOption | null>(null)
  const [channel, setChannel] = useState<SalesChannel | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [requestKey, setRequestKey] = useState(newRequestKey)
  const [validationError, setValidationError] = useState<string | null>(null)
  const shortages = saleShortages(error)

  function chooseRecipe(next: RecipeOption | null) {
    if (next?.uuid !== recipe?.uuid) setRequestKey(newRequestKey())
    setRecipe(next)
  }

  function chooseChannel(next: SalesChannel | null) {
    if (next?.uuid !== channel?.uuid) setRequestKey(newRequestKey())
    setChannel(next)
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
          <SheetTitle>{t('operations:sales.create.title')}</SheetTitle>
          <SheetDescription>
            {t('operations:sales.create.description', {
              branch: branchName,
            })}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            if (!recipe) {
              setValidationError(t('operations:sales.create.chooseRecipe'))
              return
            }
            if (!recipe.sellable) {
              setValidationError(t('operations:sales.create.notSellable'))
              return
            }
            if (recipe.sellingPrice === null) {
              setValidationError(t('operations:sales.create.missingPrice'))
              return
            }
            if (!channel) {
              setValidationError(t('operations:sales.create.chooseChannel'))
              return
            }
            try {
              const body = SalesPageModel.input.parse({
                recipeUuid: recipe.uuid,
                channelUuid: channel.uuid,
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
                label={t('operations:sales.create.recipe')}
                value={recipe}
                disabled={pending}
                sellableOnly
                onChange={chooseRecipe}
              />
              {recipe != null && !recipe.sellable && (
                <p role='alert' className='text-sm text-destructive'>
                  {t('operations:sales.create.notSellable')}
                </p>
              )}
              {recipe != null &&
                recipe.sellable &&
                recipe.sellingPrice === null && (
                  <p role='alert' className='text-sm text-destructive'>
                    {t('operations:sales.create.missingPrice')}
                  </p>
                )}
              {recipe != null && recipe.sellingPrice !== null && (
                <p className='text-sm text-muted-foreground'>
                  {t('operations:sales.create.unitPriceNote', {
                    price: recipe.sellingPrice,
                    currency: recipe.priceCurrencyCode ?? '',
                  })}
                </p>
              )}
              <ChannelSelect
                value={channel}
                disabled={pending}
                onChange={chooseChannel}
              />
              <div className='space-y-2'>
                <Label htmlFor={quantityId}>
                  {t('operations:sales.create.quantity')}
                </Label>
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
                <p className='font-medium'>
                  {t('operations:sales.create.shortageTitle')}
                </p>
                <ul className='space-y-1'>
                  {shortages.map((shortage) => (
                    <li key={shortage.componentName}>
                      {t('operations:sales.create.shortageLine', {
                        name: shortage.componentName,
                        required: shortage.required,
                        units: shortage.componentUnits
                          ? ` ${shortage.componentUnits}`
                          : '',
                        available: shortage.available,
                        missing: shortage.missing,
                      })}
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
              {t('operations:common.cancel')}
            </Button>
            <Button
              type='submit'
              disabled={
                pending ||
                (recipe !== null &&
                  (!recipe.sellable || recipe.sellingPrice === null))
              }
            >
              {t('operations:sales.create.submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
