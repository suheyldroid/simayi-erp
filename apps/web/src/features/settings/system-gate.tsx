import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'

/**
 * Nested platform administration gate for the system category of settings.
 * Nothing below it mounts for a non-administrator, a pending session or a
 * failed session read, so the users, units and currency management queries
 * never start.
 */
export function SystemSettingsGate() {
  const session = useQuery(sessionQuery)

  if (session.isPending) return <p role='status'>Loading account…</p>

  if (session.isError)
    return (
      <div role='alert' className='space-y-2'>
        <p>Could not load your account.</p>
        <Button variant='outline' onClick={() => void session.refetch()}>
          Retry
        </Button>
      </div>
    )

  if (!isAdministrator(session.data?.user))
    return (
      <p className='text-muted-foreground'>
        System settings require platform administrator access.
      </p>
    )

  return <Outlet />
}
