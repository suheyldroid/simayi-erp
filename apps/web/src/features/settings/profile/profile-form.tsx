import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  authClient,
  organizationSessionQueryKey,
  sessionQuery,
  type SessionUser,
} from '@/lib/auth'
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
        setError(result.error.message ?? 'Could not update your profile.')
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
      toast.success('Profile updated.')
      saved = true
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : 'Could not reach the account service. Try again.'
      )
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
              label='Avatar'
              alt='Avatar preview'
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='name'
                      maxLength={150}
                      placeholder='Your name'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This is the name shown in the header and account menus.
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
            Cancel
          </Button>
          <Button type='submit' disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  )
}
