import { useQuery } from '@tanstack/react-query'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { useOrganizationMemberships } from '@/features/organization/membership-query'
import { DashboardBuilder } from './builder'
import { CriticalStockAlerts } from './components/critical-stock-alerts'
import { OrganizationCards } from './components/organization-cards'
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
          <ProfileDropdown />
        </div>
      </Header>
      <Main className='space-y-8'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('dashboard:page.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('dashboard:page.subtitle')}
          </p>
        </div>
        {session.isPending ? (
          <p role='status'>{t('dashboard:common.loadingAccount')}</p>
        ) : null}
        {session.isError ? (
          <p role='alert'>
            {t('dashboard:common.accountError')}{' '}
            <Button variant='outline' onClick={() => void session.refetch()}>
              {t('dashboard:common.retry')}
            </Button>
          </p>
        ) : null}
        {session.data ? (
          <>
            <DashboardBuilder
              key={session.data.user.id}
              scope={{
                kind: 'global',
                accountId: session.data.user.id,
                membershipSignature: membershipKey,
              }}
            />
            {isAdministrator(session.data.user) ? (
              <SystemOverview userId={session.data.user.id} />
            ) : (
              <>
                <CriticalStockAlerts
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
