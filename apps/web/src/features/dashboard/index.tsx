import { useQuery } from '@tanstack/react-query'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { useOrganizationMemberships } from '@/features/organization/membership-query'
import { OrganizationCards } from './components/organization-cards'
import { PersonalOverview } from './components/personal-overview'
import { SystemOverview } from './components/system-overview'
import { membershipSignature } from './queries'

export function Dashboard() {
  const session = useQuery(sessionQuery)
  const organizations = useOrganizationMemberships()
  const membershipKey = organizations.isSuccess
    ? membershipSignature(organizations.data)
    : organizations.isError
      ? 'unavailable'
      : 'pending'
  const membershipsResolved = !organizations.isPending

  return (
    <>
      <Header>
        <Search />
        <div className='ms-auto flex items-center gap-4'>
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className='space-y-8'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
          <p className='text-muted-foreground'>
            Your account, platform activity, and the organizations you belong
            to.
          </p>
        </div>
        {session.isPending ? <p role='status'>Loading your account…</p> : null}
        {session.isError ? (
          <p role='alert'>
            Could not load your account.{' '}
            <Button variant='outline' onClick={() => void session.refetch()}>
              Retry
            </Button>
          </p>
        ) : null}
        {session.data ? (
          <>
            {isAdministrator(session.data.user) ? (
              <SystemOverview userId={session.data.user.id} />
            ) : (
              <>
                <PersonalOverview
                  userId={session.data.user.id}
                  membershipKey={membershipKey}
                  membershipsResolved={membershipsResolved}
                />
                <OrganizationCards />
              </>
            )}
          </>
        ) : null}
      </Main>
    </>
  )
}
