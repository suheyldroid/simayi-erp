import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SheetFooter } from '@/components/ui/sheet'
import { usersApi } from '../api'
import type { User } from '../model'

export function AccountProfileForm({
  user,
  onSaved,
}: {
  user: User
  onSaved?: () => void
}) {
  const client = useQueryClient()
  const form = useForm({
    defaultValues: { name: user.name, image: user.image ?? '' },
  })

  async function submit(input: { name: string; image: string }) {
    try {
      const saved = await usersApi.updateProfile(user.id, {
        name: input.name.trim(),
        image: input.image.trim() || null,
      })
      form.reset({ name: saved.name, image: saved.image ?? '' })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['user-options'] }),
        client.invalidateQueries({ queryKey: ['user', user.id] }),
        client.invalidateQueries({ queryKey: ['session'] }),
      ])
      toast.success('Account profile updated.')
      onSaved?.()
    } catch {
      form.setError('root', {
        message:
          'Could not update the account profile. Check values and platform administrator access.',
      })
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className='flex min-h-0 flex-1 flex-col'
    >
      <fieldset
        disabled={form.formState.isSubmitting}
        className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4'
      >
        <div className='space-y-2'>
          <Label htmlFor='account-profile-name'>Name</Label>
          <Input
            id='account-profile-name'
            required
            maxLength={150}
            {...form.register('name', {
              required: true,
              validate: (value) => !!value.trim(),
            })}
          />
          {form.formState.errors.name && <p role='alert'>Enter a name.</p>}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='account-profile-image'>Avatar URL</Label>
          <Input
            id='account-profile-image'
            type='url'
            maxLength={2048}
            {...form.register('image')}
          />
        </div>
        {form.formState.errors.root && (
          <p role='alert' className='text-destructive'>
            {form.formState.errors.root.message}
          </p>
        )}
      </fieldset>
      <SheetFooter>
        <Button disabled={form.formState.isSubmitting}>
          Save account profile
        </Button>
      </SheetFooter>
    </form>
  )
}
