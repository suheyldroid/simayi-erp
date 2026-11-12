import { useQuery } from '@tanstack/react-query'
import { organizationSessionQuery } from '@/lib/auth'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { DashboardBuilder } from '@/features/dashboard/builder'
import { errorMessage } from '@/features/dashboard/builder/api'

/**
 * Organization workspace overview. The page now hosts the account's personal
 * dashboard for this organization: the boundary has already verified the slug
 * membership and the active organization, and the shell provides the business
 * navigation. Every member sees the same organization data with a private
 * layout.
 */
export function OrganizationDashboard() {
  const { organization, organizationId, organizationSlug } =
    useOrganizationBoundary()
  const session = useQuery(organizationSessionQuery)

  return (
    <>
      <Header fixed>
        <div className='ms-auto'>
          <ProfileDropdown />
        </div>
      </Header>
      <Main id='content' className='space-y-8'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Overview</h1>
          <p className='text-muted-foreground'>
            Your personal dashboard for {organization.name || organizationSlug}.
            Only you can edit this layout; the organization data is shared with
            every member.
          </p>
        </div>
        {session.isPending ? <p role='status'>Loading your account…</p> : null}
        {session.isError ? (
          <div role='alert' className='space-y-2'>
            <p>Could not load your account. {errorMessage(session.error)}</p>
            <Button variant='outline' onClick={() => void session.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
        {session.data ? (
          <DashboardBuilder
            key={`${organizationId}:${session.data.user.id}`}
            scope={{
              kind: 'organization',
              accountId: session.data.user.id,
              organizationId,
              organizationSlug,
            }}
          />
        ) : null}
      </Main>
    </>
  )
}
