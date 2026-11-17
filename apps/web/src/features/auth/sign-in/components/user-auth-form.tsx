import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { authClient, safeRedirect, sessionQuery } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  email: z.email({
    error: (iss) =>
      iss.input === '' ? t('global:auth.validation.emailRequired') : undefined,
  }),
  password: z.string().min(1, t('global:auth.validation.passwordRequired')),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      const { error } = await authClient.signIn.email(data)
      if (error) {
        form.setError('root', {
          message:
            error.status === 429
              ? t('global:auth.signIn.tooManyAttempts')
              : t('global:auth.signIn.failed'),
        })
        return
      }
      queryClient.clear()
      const session = await queryClient.fetchQuery(sessionQuery)
      if (!session) throw new Error('Session unavailable')
      toast.success(
        t('global:auth.signIn.welcome', { name: session.user.name })
      )
      await navigate({ to: safeRedirect(redirectTo), replace: true })
    } catch {
      form.setError('root', { message: t('global:auth.signIn.connection') })
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('global:auth.emailLabel')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('global:auth.emailPlaceholder')}
                  autoComplete='username'
                  inputMode='email'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>{t('global:auth.passwordLabel')}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder='********'
                  autoComplete='current-password'
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                {t('global:auth.signIn.forgotPassword')}
              </Link>
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p role='alert' className='text-sm text-destructive'>
            {form.formState.errors.root.message}
          </p>
        )}
        <Button className='mt-2' disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className='animate-spin' />
          ) : (
            <LogIn />
          )}{' '}
          {t('global:auth.signIn.submit')}
        </Button>
      </form>
    </Form>
  )
}
