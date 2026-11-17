import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authClient, sessionQuery } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SheetFooter } from '@/components/ui/sheet'
import { PasswordInput } from '@/components/password-input'
import { nativeErrorText } from '../api'
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
          message: nativeErrorText(
            error.message,
            t('global:users.credentials.saveFailed')
          ),
        })
        return
      }
      onSaved()
      if (!creating && currentUser?.user.id === target.id) {
        queryClient.clear()
        await navigate({ to: '/sign-in', replace: true })
        toast.success(t('global:users.credentials.passwordResetSignedOut'))
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['users'] }),
          queryClient.invalidateQueries({ queryKey: ['user-options'] }),
        ])
        toast.success(
          creating
            ? t('global:users.credentials.userCreated')
            : t('global:users.credentials.passwordReset')
        )
      }
    } catch {
      form.setError('root', {
        message: t('global:users.credentials.genericSaveFailed'),
      })
    }
  }

  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={form.handleSubmit(submit)}
    >
      <fieldset
        disabled={form.formState.isSubmitting}
        className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4'
      >
        {creating && (
          <>
            <div className='space-y-2'>
              <Label htmlFor='user-name'>
                {t('global:users.credentials.nameLabel')}
              </Label>
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
              {form.formState.errors.name && (
                <p role='alert'>{t('global:users.credentials.nameRequired')}</p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='user-email'>
                {t('global:users.credentials.emailLabel')}
              </Label>
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
            {creating
              ? t('global:users.credentials.initialPassword')
              : t('global:users.credentials.newPassword')}
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
            {t('global:users.credentials.passwordHint')}
          </p>
        </div>
        {form.formState.errors.root && (
          <p role='alert' className='text-sm text-destructive'>
            {form.formState.errors.root.message}
          </p>
        )}
      </fieldset>
      <SheetFooter>
        <Button disabled={form.formState.isSubmitting}>
          {creating
            ? t('global:users.credentials.createUser')
            : t('global:users.credentials.resetPassword')}
        </Button>
      </SheetFooter>
    </form>
  )
}
