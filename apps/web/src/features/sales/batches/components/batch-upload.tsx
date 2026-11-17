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

export function BatchUpload({
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
  onSubmit: (file: File) => void
}) {
  const fileId = useId()
  const [file, setFile] = useState<File | null>(null)
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
          <SheetTitle>{t('operations:batches.upload.title')}</SheetTitle>
          <SheetDescription>
            {t('operations:batches.upload.description', { branch: branchName })}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            if (file === null) {
              setValidationError(t('operations:batches.upload.chooseFile'))
              return
            }
            setValidationError(null)
            onSubmit(file)
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <div className='space-y-2'>
              <Label htmlFor={fileId}>
                {t('operations:batches.upload.workbook')}
              </Label>
              <Input
                id={fileId}
                type='file'
                accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                disabled={pending}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className='text-xs text-muted-foreground'>
                {t('operations:batches.upload.hint')}
              </p>
            </div>
            {(validationError != null || error != null) && (
              <p role='alert' className='text-destructive'>
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
              {pending
                ? t('operations:batches.upload.pending')
                : t('operations:batches.upload.submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
