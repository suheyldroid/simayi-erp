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
import { errorMessage } from '../api'
import { FinancePageModel, type MoneyInput } from '../model'

function newRequestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `money-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * One positive money entry form. The request key is regenerated whenever the
 * user changes the amount or date, so a retry of the same intent replays the
 * original entry instead of posting it twice.
 */
export function MoneyForm({
  title,
  description,
  currencyCode,
  hint,
  submitLabel,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  currencyCode?: string | null
  hint?: string
  submitLabel: string
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (input: MoneyInput) => void
}) {
  const amountId = useId()
  const dateId = useId()
  const noteId = useId()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [requestKey, setRequestKey] = useState(newRequestKey)
  const [validationError, setValidationError] = useState<string | null>(null)

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            const parsed = FinancePageModel.positiveInput.safeParse({
              amount,
              date,
              note,
              requestKey,
            })
            if (!parsed.success) {
              setValidationError(
                parsed.error.issues[0]?.message ??
                  t('operations:finance.form.checkEntry')
              )
              return
            }
            setValidationError(null)
            onSubmit(parsed.data)
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor={amountId}>
                  {currencyCode
                    ? t('operations:finance.form.amountWithCurrency', {
                        currency: currencyCode,
                      })
                    : t('operations:finance.form.amount')}
                </Label>
                <Input
                  id={amountId}
                  name='amount'
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                    setRequestKey(newRequestKey())
                  }}
                  inputMode='decimal'
                  maxLength={20}
                  required
                  placeholder={t('operations:finance.form.amountPlaceholder')}
                  aria-describedby={hint ? `${amountId}-hint` : undefined}
                />
                <p
                  id={`${amountId}-hint`}
                  className='text-xs text-muted-foreground'
                >
                  {hint ?? t('operations:finance.form.amountHint')}
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor={dateId}>
                  {t('operations:finance.form.date')}
                </Label>
                <Input
                  id={dateId}
                  name='date'
                  type='date'
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setRequestKey(newRequestKey())
                  }}
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor={noteId}>
                  {t('operations:finance.form.note')}
                </Label>
                <Input
                  id={noteId}
                  name='note'
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  placeholder={t('operations:finance.form.notePlaceholder')}
                />
              </div>
            </fieldset>
            {(validationError != null || error != null) && (
              <p role='alert' className='text-sm text-destructive'>
                {validationError ?? errorMessage(error)}
              </p>
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
            <Button type='submit' disabled={pending}>
              {pending ? t('operations:common.saving') : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
