import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/api-error'
import {
  authClient,
  organizationSessionQueryKey,
  sessionQuery,
  type SessionUser,
} from '@/lib/auth'
import { t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SheetFooter } from '@/components/ui/sheet'
import { ImageInput } from '@/components/image-input'
import {
  profileFormSchema,
  profileUpdateInput,
  type ProfileFormValues,
} from '../model'
import { avatarReferencePrefix, profileAvatarApi } from './avatar-api'

/**
 * Edits the signed-in user's native Better Auth account through
 * `authClient.updateUser`. The parent Sheet owns the header and dismissal; this
 * form reports its in-flight state so no request can be abandoned mid-save.
 */
export function ProfileForm({
  user,
  onSaved,
  onCancel,
  onPendingChange,
}: {
  user: SessionUser
  onSaved: () => void
  onCancel: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const client = useQueryClient()
  const [image, setImage] = useState<string | null>(user.image ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: user.name },
    mode: 'onChange',
  })

  async function submit(values: ProfileFormValues) {
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
        ? (await profileAvatarApi.upload(submittedFile)).reference
        : submittedImage
      // Keep the uploaded reference if the native update fails; a retry must
      // reuse it instead of uploading the same file again.
      if (submittedFile) {
        setImage(imageRef ?? null)
        setFile(null)
      }
      const input = profileUpdateInput(values, imageRef ?? null)
      const result = await authClient.updateUser(input)
      if (result.error) {
        setError(errorMessage(result.error))
        return
      }
      form.reset({ name: input.name })
      // The native endpoint rewrites the session cookie; refetch both the
      // global account session (header name/avatar) and the organization shell
      // session, plus the platform user caches that project this account.
      await Promise.all([
        client.invalidateQueries({ queryKey: sessionQuery.queryKey }),
        client.invalidateQueries({ queryKey: organizationSessionQueryKey }),
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['user', user.id] }),
        client.invalidateQueries({ queryKey: ['user-options'] }),
      ])
      toast.success(t('global:settings.profile.updated'))
      saved = true
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
      onPendingChange(false)
    }
    if (saved) onSaved()
  }

  return (
    <Form {...form}>
      <form
        className='flex min-h-0 flex-1 flex-col'
        onSubmit={form.handleSubmit(submit)}
      >
        <div className='min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4'>
          <fieldset disabled={pending} className='space-y-6'>
            <ImageInput
              image={image}
              file={file}
              disabled={pending}
              resolveImage={imageUrl}
              credentialImagePrefix={avatarReferencePrefix}
              label={t('global:settings.profile.avatarLabel')}
              alt={t('global:settings.profile.avatarAlt')}
              onChange={(next) => {
                setImage(next.image)
                setFile(next.file)
              }}
            />

            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('global:settings.profile.nameLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='name'
                      maxLength={150}
                      placeholder={t('global:settings.profile.namePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('global:settings.profile.nameDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
          {error ? (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            type='button'
            variant='outline'
            disabled={pending}
            onClick={onCancel}
          >
            {t('global:settings.profile.cancel')}
          </Button>
          <Button type='submit' disabled={pending}>
            {pending
              ? t('global:shared.saving')
              : t('global:settings.profile.save')}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  )
}
