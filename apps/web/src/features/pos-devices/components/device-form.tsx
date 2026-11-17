import { useId, useState, type FormEvent } from 'react'
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
import { FlagInput } from '@/components/flag-input'
import { errorMessage } from '../api'
import {
  PosDevicesPageModel,
  type PosDevice,
  type PosDeviceInput,
} from '../model'

/**
 * Bank POS device form. Update always submits the version the sheet was opened
 * with, so a concurrent edit fails instead of overwriting. There is no delete:
 * clearing `active` retires a device. The branch is fixed by the selected
 * branch context and can never be changed here.
 */
export function DeviceForm({
  device,
  branchName,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  device: PosDevice | 'new'
  branchName: string
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (body: PosDeviceInput) => void
}) {
  const creating = device === 'new'
  const current = creating ? undefined : device
  const nameId = useId()
  const bankId = useId()
  const terminalId = useId()
  const [name, setName] = useState(current?.name ?? '')
  const [bankName, setBankName] = useState(current?.bankName ?? '')
  const [terminal, setTerminal] = useState(current?.terminalId ?? '')
  const [active, setActive] = useState(current?.active ?? true)
  const [validationError, setValidationError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const parsed = PosDevicesPageModel.deviceInput.safeParse({
      name,
      bankName,
      terminalId: terminal,
      active,
    })
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ??
          t('operations:posDevices.form.checkDetails')
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
            {creating
              ? t('operations:posDevices.form.createTitle')
              : t('operations:posDevices.form.editTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('operations:posDevices.form.description')}
          </SheetDescription>
        </SheetHeader>
        <form className='flex min-h-0 flex-1 flex-col' onSubmit={submit}>
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>
                  {t('operations:posDevices.form.branch')}
                </p>
                <p className='text-sm'>{branchName}</p>
                <p className='text-xs text-muted-foreground'>
                  {t('operations:posDevices.form.branchHint')}
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor={nameId}>
                  {t('operations:posDevices.form.name')}
                </Label>
                <Input
                  id={nameId}
                  name='name'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder={t('operations:posDevices.form.namePlaceholder')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor={bankId}>
                  {t('operations:posDevices.form.bank')}
                </Label>
                <Input
                  id={bankId}
                  name='bankName'
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder={t('operations:posDevices.form.bankPlaceholder')}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor={terminalId}>
                  {t('operations:posDevices.form.terminalId')}
                </Label>
                <Input
                  id={terminalId}
                  name='terminalId'
                  value={terminal}
                  onChange={(event) => setTerminal(event.target.value)}
                  maxLength={100}
                  required
                  placeholder={t(
                    'operations:posDevices.form.terminalPlaceholder'
                  )}
                />
              </div>
              <FlagInput
                name='active'
                label={t('operations:posDevices.form.active')}
                checked={active}
                disabled={pending}
                onChange={setActive}
              />
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
              {t('operations:common.cancel')}
            </Button>
            <Button type='submit' disabled={pending}>
              {pending
                ? t('operations:common.saving')
                : creating
                  ? t('operations:posDevices.form.submitCreate')
                  : t('operations:posDevices.form.submitSave')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
