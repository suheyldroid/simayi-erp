import { Link } from '@tanstack/react-router'
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
import { OtpForm } from './components/otp-form'

export function Otp() {
  return (
    <AuthLayout>
      <Card className='max-w-md gap-4'>
        <CardHeader>
          <CardTitle className='text-base tracking-tight'>
            {t('global:auth.otp.title')}
          </CardTitle>
          <CardDescription>
            {t('global:auth.otp.description')} <br />{' '}
            {t('global:auth.otp.sentHint')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OtpForm />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            {t('global:auth.otp.resendPrompt')}{' '}
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              {t('global:auth.otp.resendLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
