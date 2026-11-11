import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const imageAccept = 'image/png,image/jpeg,image/webp'
const imageMaxBytes = 512 * 1024
const allowedTypes = new Set(imageAccept.split(','))

type Selection = { file: File; url: string }

/**
 * Shared image picker with local preview, replace and remove actions. The
 * parent keeps the stored reference and the pending file; this component owns
 * only the object URL used to preview the selected file.
 */
export function ImageInput({
  image,
  file,
  disabled,
  onChange,
  resolveImage,
  credentialImagePrefix,
  label = 'Image',
  alt = 'Image preview',
}: {
  image: string | null
  file: File | null
  disabled: boolean
  onChange: (next: { image: string | null; file: File | null }) => void
  resolveImage: (image: string) => string
  /** Stored references under this path are read with credentials. */
  credentialImagePrefix?: string
  label?: string
  alt?: string
}) {
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Selection | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (selectionRef.current) URL.revokeObjectURL(selectionRef.current.url)
    }
  }, [])

  // The parent drops the local file after a successful upload; release the
  // preview URL then as well. No state is set synchronously in an effect.
  useEffect(() => {
    if (file === null && selectionRef.current) {
      URL.revokeObjectURL(selectionRef.current.url)
      selectionRef.current = null
    }
  }, [file])

  const localUrl = selection && selection.file === file ? selection.url : null
  const previewSrc = localUrl ?? (image ? resolveImage(image) : null)
  const loadFailed = failedSrc !== null && failedSrc === previewSrc
  const hasImage = image !== null || file !== null

  function dropSelection() {
    if (selectionRef.current) {
      URL.revokeObjectURL(selectionRef.current.url)
      selectionRef.current = null
    }
  }

  function select(next: File) {
    if (!allowedTypes.has(next.type)) {
      setError('Choose a PNG, JPEG, or WebP image.')
      return
    }
    if (next.size === 0) {
      setError('The selected image is empty.')
      return
    }
    if (next.size > imageMaxBytes) {
      setError('Images must be 512 KB or smaller.')
      return
    }
    dropSelection()
    const value = { file: next, url: URL.createObjectURL(next) }
    selectionRef.current = value
    setSelection(value)
    setError(null)
    setFailedSrc(null)
    onChange({ image, file: next })
  }

  function clear() {
    dropSelection()
    setSelection(null)
    setError(null)
    setFailedSrc(null)
    if (inputRef.current) inputRef.current.value = ''
    onChange({ image: null, file: null })
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor={inputId}>{label}</Label>
      <div className='flex items-start gap-4'>
        <div className='flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted'>
          {previewSrc && !loadFailed ? (
            <img
              src={previewSrc}
              alt={alt}
              className='size-full object-contain'
              crossOrigin={
                localUrl === null &&
                image !== null &&
                credentialImagePrefix !== undefined &&
                image.startsWith(credentialImagePrefix)
                  ? 'use-credentials'
                  : undefined
              }
              onError={() => setFailedSrc(previewSrc)}
            />
          ) : (
            <span className='px-2 text-center text-xs text-muted-foreground'>
              {loadFailed ? 'Preview unavailable' : 'No image'}
            </span>
          )}
        </div>
        <div className='min-w-0 space-y-2'>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {hasImage ? 'Replace image' : 'Choose image'}
            </Button>
            {hasImage && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={disabled}
                onClick={clear}
              >
                Remove
              </Button>
            )}
          </div>
          <p id={hintId} className='text-xs text-muted-foreground'>
            {file
              ? `New file: ${file.name}`
              : image
                ? 'Current image. A new file uploads when you save.'
                : 'PNG, JPEG, or WebP up to 512 KB.'}
          </p>
          {error && (
            <p id={errorId} role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          {loadFailed && (
            <p role='alert' className='text-sm text-destructive'>
              The image could not be loaded.
            </p>
          )}
          <Input
            ref={inputRef}
            id={inputId}
            type='file'
            accept={imageAccept}
            className='sr-only'
            disabled={disabled}
            aria-label='Choose image file'
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hintId}
            onChange={(event) => {
              const next = event.currentTarget.files?.[0]
              // Reset the native value so selecting the same file again fires.
              event.currentTarget.value = ''
              if (next) select(next)
            }}
          />
        </div>
      </div>
    </div>
  )
}
