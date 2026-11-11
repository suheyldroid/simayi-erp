import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { useShellReset } from './use-shell-reset'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

/**
 * Authentication only. It renders no sidebar, no organization switcher and no
 * tenant query: the system shell and the organization detail shell are separate
 * route layouts underneath it. Session failure and sign-out handling belong
 * here because they must apply to every authenticated page.
 */
export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const sessionRequest = useQuery({
    ...sessionQuery,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const session = sessionRequest.data

  // Ephemeral authenticated state must not survive a re-sign-in. The
  // organization shell additionally resets on its own slug boundary.
  useShellReset(session?.session.id ?? null)

  useEffect(() => {
    if (session === null) {
      queryClient.clear()
      void navigate({
        to: '/sign-in',
        search: { redirect: location.href },
        replace: true,
      })
    }
  }, [session, queryClient, navigate, location.href])

  // A failed session request must not keep rendering the last successful
  // session (or any authenticated UI). Show only a neutral retry surface,
  // without the outlet or any session-derived content.
  if (sessionRequest.isError) {
    return (
      <div className='flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center'>
        <div role='alert' className='space-y-2'>
          <p className='font-medium'>Could not load your account.</p>
          <p className='text-sm text-muted-foreground'>
            Your session could not be verified.
          </p>
        </div>
        <Button variant='outline' onClick={() => void sessionRequest.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!session) return null

  return <>{children ?? <Outlet key={session.session.id} />}</>
}
