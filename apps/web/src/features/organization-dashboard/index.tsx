import { useQuery } from '@tanstack/react-query'
import { organizationSessionQuery } from '@/lib/auth'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { t } from '@/lib/i18n'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { DashboardBuilder } from '@/features/dashboard/builder'
import { errorMessage } from '@/features/dashboard/builder/api'

/**
 * Organization workspace overview. The page hosts the account's personal
 * dashboard for this company: the boundary has already verified the slug
 * membership, the active organization and any selected branch. The saved
 * layout belongs to the account and company, while the business data follows
 * the selected branch, or the company-wide rollup when no branch is selected.
 */
export function OrganizationDashboard() {
  const { organization, organizationId, organizationSlug } =
    useOrganizationBoundary()
  const branch = useOptionalBranch()
  const session = useQuery(organizationSessionQuery)

  return (
    <>
      <Header fixed>
        <div className='ms-auto'>
          <ProfileDropdown />
        </div>
      </Header>
      <Main id='content' className='space-y-8'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('dashboard:overview.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('dashboard:overview.subtitle', {
              organization: organization.name || organizationSlug,
            })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('dashboard:overview.dataScope')}{' '}
            <span className='font-medium text-foreground'>
              {branch
                ? t('dashboard:overview.branchOnly', {
                    branch: branch.branch.name,
                  })
                : t('dashboard:overview.companyWide')}
            </span>
            . {t('dashboard:overview.hint')}
          </p>
        </div>
        {session.isPending ? (
          <p role='status'>{t('dashboard:common.loadingAccount')}</p>
        ) : null}
        {session.isError ? (
          <div role='alert' className='space-y-2'>
            <p>
              {t('dashboard:common.accountError')} {errorMessage(session.error)}
            </p>
            <Button variant='outline' onClick={() => void session.refetch()}>
              {t('dashboard:common.retry')}
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
              branchUuid: branch?.branchUuid ?? null,
              branchName: branch?.branch.name ?? null,
            }}
          />
        ) : null}
      </Main>
    </>
  )
}
