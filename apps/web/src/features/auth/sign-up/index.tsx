import { Link } from '@tanstack/react-router'
import { Trans } from 'react-i18next'
import { t } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('global:auth.signUp.title')}
          </CardTitle>
          <CardDescription>
            {t('global:auth.signUp.description')} <br />
            {t('global:auth.signUp.alreadyHaveAccount')}{' '}
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              {t('global:auth.signUp.signInLink')}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            <Trans
              ns='global'
              i18nKey='auth.signUp.terms'
              components={{
                terms: (
                  <a
                    href='/terms'
                    className='underline underline-offset-4 hover:text-primary'
                  />
                ),
                privacy: (
                  <a
                    href='/privacy'
                    className='underline underline-offset-4 hover:text-primary'
                  />
                ),
              }}
            />
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
