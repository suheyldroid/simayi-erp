import { useId, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { currencyApi } from '@/features/currency/api'
import { errorMessage } from '../api'
import {
  PosDevicesPageModel,
  type ZReport,
  type ZReportBatch,
  type ZReportInput,
} from '../model'
import { BatchSelect } from './batch-select'

function localParts(value: Date) {
  const day = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(value.getDate()).padStart(2, '0')}`
  return {
    day,
    dateTime: `${day}T${String(value.getHours()).padStart(
      2,
      '0'
    )}:${String(value.getMinutes()).padStart(2, '0')}`,
  }
}

/**
 * Z report form. The linked sales batch is a single optional choice; the
 * device comes from the route and cannot be changed here. No finance entry is
 * written by this form.
 */
export function ReportForm({
  report,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  report: ZReport | 'new'
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: ZReportInput) => void
}) {
  const creating = report === 'new'
  const current = creating ? undefined : report
  const numberId = useId()
  const businessDateId = useId()
  const closedAtId = useId()
  const amountId = useId()
  const noteId = useId()
  const [reportNumber, setReportNumber] = useState(current?.reportNumber ?? '')
  const [businessDate, setBusinessDate] = useState(
    () => current?.businessDate ?? localParts(new Date()).day
  )
  const [closedAt, setClosedAt] = useState(
    () => localParts(current ? new Date(current.closedAt) : new Date()).dateTime
  )
  const [closedAtEdited, setClosedAtEdited] = useState(false)
  const [totalAmount, setTotalAmount] = useState(current?.totalAmount ?? '')
  const [note, setNote] = useState(current?.note ?? '')
  const [batch, setBatch] = useState<ZReportBatch | null>(
    current?.salesBatch ?? null
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const preference = useQuery({
    queryKey: ['system-preference'],
    queryFn: () => currencyApi.preference(),
    // The create form only hints the system currency; an edit shows the
    // immutable snapshot stored with the report.
    enabled: creating,
  })
  const currencyCode =
    report === 'new'
      ? (preference.data?.defaultCurrencyCode ?? null)
      : report.currencyCode

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    // An untouched field keeps the stored timestamp exactly: the local input
    // only has minutes, so converting it would silently drop seconds.
    let closedIso: string
    if (report !== 'new' && !closedAtEdited) {
      closedIso = report.closedAt
    } else {
      const closed = new Date(closedAt)
      if (Number.isNaN(closed.getTime())) {
        setValidationError('Enter the local date and time the report closed.')
        return
      }
      closedIso = closed.toISOString()
    }
    const parsed = PosDevicesPageModel.reportInput.safeParse({
      reportNumber,
      businessDate,
      closedAt: closedIso,
      totalAmount,
      note,
      salesBatchUuid: batch?.uuid ?? null,
    })
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? 'Check the Z report details.'
      )
      return
    }
    setValidationError(null)
    onSubmit(parsed.data)
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-lg'
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {creating ? 'Create Z report' : 'Edit Z report'}
          </SheetTitle>
          <SheetDescription>
            {creating
              ? 'A Z report is the bank POS end-of-day evidence for this device. It records no sale and writes no finance entry.'
              : 'Attach, detach or reassign one processed sales batch. Linking is evidence only: it may cover only part of the batch and never settles, collects or moves money.'}
          </SheetDescription>
        </SheetHeader>
        <form className='flex min-h-0 flex-1 flex-col' onSubmit={submit}>
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor={numberId}>Report number</Label>
                <Input
                  id={numberId}
                  name='reportNumber'
                  value={reportNumber}
                  onChange={(event) => setReportNumber(event.target.value)}
                  maxLength={100}
                  required
                  placeholder='Report number printed by the terminal'
                />
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor={businessDateId}>Business date</Label>
                  <Input
                    id={businessDateId}
                    name='businessDate'
                    type='date'
                    value={businessDate}
                    onChange={(event) => setBusinessDate(event.target.value)}
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor={closedAtId}>Closed at (local time)</Label>
                  <Input
                    id={closedAtId}
                    name='closedAt'
                    type='datetime-local'
                    value={closedAt}
                    onChange={(event) => {
                      setClosedAt(event.target.value)
                      setClosedAtEdited(true)
                    }}
                    required
                  />
                </div>
              </div>
              <p className='text-xs text-muted-foreground'>
                The closing time is stored as a timezone-aware timestamp; the
                business date stays a plain day.
              </p>
              <div className='space-y-2'>
                <Label htmlFor={amountId}>
                  Total amount
                  {currencyCode ? ` (${currencyCode})` : ''}
                </Label>
                <Input
                  id={amountId}
                  name='totalAmount'
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                  inputMode='decimal'
                  maxLength={20}
                  required
                  placeholder='e.g. 2450.75'
                />
                <p className='text-xs text-muted-foreground'>
                  The amount printed on the report, with up to 6 decimals. It is
                  an evidence figure, not a finance posting.
                </p>
              </div>
              <BatchSelect
                label='Sales batch (optional)'
                value={batch}
                disabled={pending}
                onChange={setBatch}
              />
              <div className='space-y-2'>
                <Label htmlFor={noteId}>Note</Label>
                <Textarea
                  id={noteId}
                  name='note'
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder='Optional note'
                />
              </div>
            </fieldset>
            {validationError != null || error != null ? (
              <p role='alert' className='text-sm text-destructive'>
                {validationError ?? errorMessage(error)}
              </p>
            ) : null}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={pending}>
              {pending ? 'Saving…' : creating ? 'Create report' : 'Save report'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
