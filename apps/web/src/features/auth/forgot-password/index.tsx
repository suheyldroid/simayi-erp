import { Link } from '@tanstack/react-router'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <Card className='max-w-sm'>
        <CardHeader>
          <CardTitle>{t('global:auth.forgotPassword.title')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p>{t('global:auth.forgotPassword.description')}</p>
          <Link to='/sign-in' className='underline'>
            {t('global:auth.forgotPassword.backToSignIn')}
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
