import { useForm, useWatch } from 'react-hook-form'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Label } from '@/components/ui/label'
import {
  profileFormSchema,
  profileUpdateInput,
  type ProfileFormValues,
} from '../model'

/**
 * Edits the signed-in user's native Better Auth account through
 * `authClient.updateUser`. No organization is selected or required, and no
 * organization-scoped UserProfile record is read or written.
 */
export function ProfileForm({ user }: { user: SessionUser }) {
  const client = useQueryClient()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: user.name, image: user.image ?? '' },
    mode: 'onChange',
  })
  const name = useWatch({ control: form.control, name: 'name' })
  const image = useWatch({ control: form.control, name: 'image' })
  const preview = image.trim()
  const initials = name.trim().slice(0, 2).toUpperCase() || 'U'

  async function submit(values: ProfileFormValues) {
    form.clearErrors('root')
    const input = profileUpdateInput(values)
    let failure: string | null = null
    try {
      const result = await authClient.updateUser(input)
      if (result.error) {
        failure = result.error.message ?? 'Could not update your profile.'
      }
    } catch (error) {
      failure =
        error instanceof Error && error.message
          ? error.message
          : 'Could not reach the account service. Try again.'
    }
    if (failure) {
      // Keep the entered values so the user can correct and retry.
      form.setError('root', { message: failure })
      return
    }
    form.reset({ name: input.name, image: input.image ?? '' })
    // The native endpoint rewrites the session cookie; refetch both the global
    // account session (header name/avatar) and the organization shell session,
    // plus the platform user caches that project this account.
    await Promise.all([
      client.invalidateQueries({ queryKey: sessionQuery.queryKey }),
      client.invalidateQueries({ queryKey: organizationSessionQueryKey }),
      client.invalidateQueries({ queryKey: ['users'] }),
      client.invalidateQueries({ queryKey: ['user', user.id] }),
      client.invalidateQueries({ queryKey: ['user-options'] }),
    ])
    toast.success('Profile updated.')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        {/* A disabled fieldset freezes the editable inputs while the update is
            in flight, so no keystroke can be silently replaced by the reset. */}
        <fieldset disabled={form.formState.isSubmitting} className='space-y-8'>
          <div className='flex items-center gap-4'>
            <Avatar className='size-16 rounded-lg'>
              <AvatarImage
                src={preview ? imageUrl(preview) : undefined}
                alt=''
              />
              <AvatarFallback className='rounded-lg'>{initials}</AvatarFallback>
            </Avatar>
            <p className='text-sm text-muted-foreground'>Avatar preview</p>
          </div>

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

          <FormField
            control={form.control}
            name='image'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar URL</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    inputMode='url'
                    maxLength={2048}
                    placeholder='https://example.com/avatar.png'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Absolute http(s) URL of your avatar image. Leave it empty to
                  remove the avatar.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-2'>
            <Label htmlFor='profile-email'>Email</Label>
            <Input
              id='profile-email'
              type='email'
              value={user.email}
              readOnly
              aria-describedby='profile-email-description'
            />
            <p
              id='profile-email-description'
              className='text-sm text-muted-foreground'
            >
              Read-only. Email changes are not enabled in this deployment:
              Better Auth's change-email flow is off and no verification email
              sender is configured.
            </p>
          </div>

          {form.formState.errors.root ? (
            <p role='alert' className='text-sm text-destructive'>
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <Button type='submit' disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Updating…' : 'Update profile'}
          </Button>
        </fieldset>
      </form>
    </Form>
  )
}
