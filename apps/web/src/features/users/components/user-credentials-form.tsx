import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authClient, sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import type { User } from '../model'

type CredentialsInput = { name: string; email: string; password: string }

export function UserCredentialsForm({
  target,
  onSaved,
}: {
  target: User | 'new'
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: currentUser } = useQuery(sessionQuery)
  const form = useForm<CredentialsInput>({
    defaultValues: { name: '', email: '', password: '' },
  })
  const creating = target === 'new'

  async function submit(input: CredentialsInput) {
    try {
      const { error } = creating
        ? await authClient.admin.createUser({
            ...input,
            name: input.name.trim(),
            email: input.email.trim(),
            role: 'user',
          })
        : await authClient.admin.setUserPassword({
            userId: target.id,
            newPassword: input.password,
          })
      if (error) {
        form.setError('root', {
          message: error.message ?? 'Could not save user.',
        })
        return
      }
      onSaved()
      if (!creating && currentUser?.id === target.id) {
        queryClient.clear()
        await navigate({ to: '/sign-in', replace: true })
        toast.success('Password reset. Sign in with your new password.')
      } else {
        await queryClient.invalidateQueries({ queryKey: ['users'] })
        toast.success(creating ? 'User created.' : 'Password reset.')
      }
    } catch {
      form.setError('root', {
        message:
          'Could not save. Check the values, email uniqueness, and your connection.',
      })
    }
  }

  return (
    <form className='space-y-4' onSubmit={form.handleSubmit(submit)}>
      {creating && (
        <>
          <div className='space-y-2'>
            <Label htmlFor='user-name'>Name</Label>
            <Input
              id='user-name'
              autoComplete='name'
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
            <Label htmlFor='user-email'>Email</Label>
            <Input
              id='user-email'
              type='email'
              autoComplete='off'
              required
              maxLength={254}
              {...form.register('email', { required: true })}
            />
          </div>
        </>
      )}
      <div className='space-y-2'>
        <Label htmlFor='user-password'>
          {creating ? 'Initial password' : 'New password'}
        </Label>
        <PasswordInput
          id='user-password'
          autoComplete='new-password'
          required
          minLength={12}
          maxLength={128}
          {...form.register('password', {
            required: true,
            minLength: 12,
            maxLength: 128,
          })}
        />
        <p className='text-sm text-muted-foreground'>
          12–128 characters. Share this password with the user through a secure
          channel.
        </p>
      </div>
      {form.formState.errors.root && (
        <p role='alert' className='text-sm text-destructive'>
          {form.formState.errors.root.message}
        </p>
      )}
      <Button disabled={form.formState.isSubmitting}>
        {creating ? 'Create user' : 'Reset password'}
      </Button>
    </form>
  )
}
