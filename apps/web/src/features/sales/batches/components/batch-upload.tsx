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
import { errorMessage } from '../api'

export function BatchUpload({
  pending,
  error,
  onClose,
  onSubmit,
}: {
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
          <SheetTitle>Upload sales workbook</SheetTitle>
          <SheetDescription>
            Upload the original .xlsx export. The upload creates a draft batch
            and never changes stock. Choose the worksheet, columns and mappings
            on the draft after uploading.
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            if (file === null) {
              setValidationError('Choose an .xlsx workbook')
              return
            }
            setValidationError(null)
            onSubmit(file)
          }}
        >
          <div className='flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
            <div className='space-y-2'>
              <Label htmlFor={fileId}>Workbook</Label>
              <Input
                id={fileId}
                type='file'
                accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                disabled={pending}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className='text-xs text-muted-foreground'>
                Only .xlsx files up to 10 MB are supported. Each worksheet may
                contain at most 5000 rows and 64 columns; larger workbooks are
                rejected instead of being silently truncated. The original file
                stays available from the draft.
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
              Cancel
            </Button>
            <Button type='submit' disabled={pending}>
              {pending ? 'Uploading…' : 'Upload'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
