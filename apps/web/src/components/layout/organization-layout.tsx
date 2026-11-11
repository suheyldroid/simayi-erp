import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { organizationSessionQuery } from '@/lib/auth'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { Button } from '@/components/ui/button'

/**
 * Organization detail boundary. Nothing tenant-scoped (workspace or settings
 * shell, feature queries, outlet) mounts until the live session reports the
 * same organization as the URL slug. Resolution itself happens in this route's
 * `beforeLoad`.
 *
 * This route owns no sidebar or provider chrome: the workspace and settings
 * shells are sibling children, so their navigation can never nest.
 */
export function OrganizationLayout() {
  const boundary = useOrganizationBoundary()
  const sessionRequest = useQuery({
    ...organizationSessionQuery,
    // The route boundary just fetched it; avoid an immediate duplicate read
    // without ever trusting a stale scope for the initial render. The interval
    // and focus refetch keep the cross-tab organization-switch detection that
    // used to live in the authenticated shell.
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const session = sessionRequest.data
  const verified =
    session?.session.activeOrganizationId === boundary.organizationId

  if (sessionRequest.isError) {
    return (
      <BoundarySurface
        title='Could not verify this organization.'
        description='Your membership could not be checked.'
        onRetry={() => void sessionRequest.refetch()}
      />
    )
  }

  if (sessionRequest.isPending) {
    return (
      <BoundarySurface
        busy
        title='Checking organization…'
        description='Confirming your membership in this organization.'
      />
    )
  }

  if (!session || !verified) {
    return (
      <BoundarySurface
        title='Organization membership changed.'
        description='Reload to continue with the requested organization.'
        onRetry={() => window.location.reload()}
      />
    )
  }

  return <Outlet key={boundary.organizationId} />
}

function BoundarySurface({
  title,
  description,
  onRetry,
  busy = false,
}: {
  title: string
  description: string
  onRetry?: () => void
  busy?: boolean
}) {
  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center'>
      <div role={busy ? 'status' : 'alert'} className='space-y-2'>
        <p className='font-medium'>{title}</p>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
      {onRetry ? (
        <Button variant='outline' onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}
