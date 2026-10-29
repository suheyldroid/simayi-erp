import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAdministrator } from '@/lib/auth'
import { Users } from '@/features/users'

export const Route = createFileRoute('/_authenticated/users/')({
  beforeLoad: ({ context }) => {
    if (!isAdministrator(context.user)) throw redirect({ to: '/403' })
  },
  component: Users,
})
