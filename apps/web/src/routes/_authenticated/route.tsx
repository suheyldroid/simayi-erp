import { createFileRoute, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/lib/auth'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.fetchQuery(sessionQuery)
    if (!user)
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    return { user }
  },
  component: AuthenticatedLayout,
})
