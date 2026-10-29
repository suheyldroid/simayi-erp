import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <Card className='max-w-sm'>
        <CardHeader>
          <CardTitle>Password assistance</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p>
            Contact your ERP administrator to create your account or reset your
            password. Email recovery and public registration are not available.
          </p>
          <Link to='/sign-in' className='underline'>
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
