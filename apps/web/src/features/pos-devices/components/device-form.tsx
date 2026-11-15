import { useId, useState, type FormEvent } from 'react'
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
 * clearing `active` retires a device.
 */
export function DeviceForm({
  device,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  device: PosDevice | 'new'
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
        parsed.error.issues[0]?.message ?? 'Check the device details.'
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
            {creating ? 'Create bank POS device' : 'Edit bank POS device'}
          </SheetTitle>
          <SheetDescription>
            This is the bank's POS terminal, not a fiscal cash register. Devices
            are deactivated, never deleted, and their Z reports stay as
            reconciliation evidence.
          </SheetDescription>
        </SheetHeader>
        <form className='flex min-h-0 flex-1 flex-col' onSubmit={submit}>
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor={nameId}>Name</Label>
                <Input
                  id={nameId}
                  name='name'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder='e.g. Front counter terminal'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor={bankId}>Bank</Label>
                <Input
                  id={bankId}
                  name='bankName'
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder='e.g. Example Bank'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor={terminalId}>Terminal ID</Label>
                <Input
                  id={terminalId}
                  name='terminalId'
                  value={terminal}
                  onChange={(event) => setTerminal(event.target.value)}
                  maxLength={100}
                  required
                  placeholder='Terminal identifier printed by the bank'
                />
              </div>
              <FlagInput
                name='active'
                label='Active'
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
              Cancel
            </Button>
            <Button type='submit' disabled={pending}>
              {pending ? 'Saving…' : creating ? 'Create device' : 'Save device'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
