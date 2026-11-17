import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SheetFooter } from '@/components/ui/sheet'
import { ImageInput } from '@/components/image-input'
import {
  avatarReferencePrefix,
  profileAvatarApi,
} from '@/features/settings/profile/avatar-api'
import { usersApi } from '../api'
import type { User } from '../model'

export function AccountProfileForm({
  user,
  onSaved,
  onCancel,
  onPendingChange,
}: {
  user: User
  onSaved?: () => void
  onCancel: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const client = useQueryClient()
  const form = useForm({ defaultValues: { name: user.name } })
  const [image, setImage] = useState<string | null>(user.image ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(input: { name: string }) {
    if (pending) return
    const submittedImage = image
    const submittedFile = file
    setPending(true)
    onPendingChange(true)
    setError(null)
    form.clearErrors('root')
    let saved = false
    try {
      const imageRef = submittedFile
        ? (await profileAvatarApi.uploadForTarget(user.id, submittedFile))
            .reference
        : submittedImage
      // Keep the uploaded reference if the native update fails; a retry must
      // reuse it instead of uploading the same file again.
      if (submittedFile) {
        setImage(imageRef ?? null)
        setFile(null)
      }
      // Omit an unchanged image: a name edit must not rewrite a historical
      // external value or an avatar the target account already owns.
      const imageChanged =
        submittedFile !== null || (imageRef ?? null) !== (user.image ?? null)
      const updated = await usersApi.updateProfile(user.id, {
        name: input.name.trim(),
        ...(imageChanged ? { image: imageRef ?? null } : {}),
      })
      form.reset({ name: updated.name })
      setImage(updated.image ?? null)
      setFile(null)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['user-options'] }),
        client.invalidateQueries({ queryKey: ['user', user.id] }),
        client.invalidateQueries({ queryKey: ['session'] }),
      ])
      toast.success(t('global:users.accountProfile.updated'))
      saved = true
    } catch {
      setError(t('global:users.accountProfile.updateFailed'))
    } finally {
      setPending(false)
      onPendingChange(false)
    }
    if (saved) onSaved?.()
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className='flex min-h-0 flex-1 flex-col'
    >
      <fieldset
        disabled={pending}
        className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4'
      >
        <div className='space-y-2'>
          <Label htmlFor='account-profile-name'>
            {t('global:users.accountProfile.nameLabel')}
          </Label>
          <Input
            id='account-profile-name'
            required
            maxLength={150}
            {...form.register('name', {
              required: true,
              validate: (value) => !!value.trim(),
            })}
          />
          {form.formState.errors.name && (
            <p role='alert'>{t('global:users.accountProfile.nameRequired')}</p>
          )}
        </div>
        <ImageInput
          image={image}
          file={file}
          disabled={pending}
          resolveImage={imageUrl}
          credentialImagePrefix={avatarReferencePrefix}
          label={t('global:users.accountProfile.avatarLabel')}
          alt={t('global:users.accountProfile.avatarAlt', { name: user.name })}
          onChange={(next) => {
            setImage(next.image)
            setFile(next.file)
          }}
        />
        {error ? (
          <p role='alert' className='text-destructive'>
            {error}
          </p>
        ) : null}
      </fieldset>
      <SheetFooter>
        <Button
          type='button'
          variant='outline'
          disabled={pending}
          onClick={onCancel}
        >
          {t('global:users.accountProfile.cancel')}
        </Button>
        <Button type='submit' disabled={pending}>
          {pending
            ? t('global:shared.saving')
            : t('global:users.accountProfile.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}
