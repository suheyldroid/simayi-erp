import { useQuery } from '@tanstack/react-query'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { errorMessage } from '../api'
import { formatCount, monthLabel, monthRangeLabel } from '../format'
import { systemDashboardQueryOptions } from '../queries'
import { ActivityChart } from './activity-chart'
import { StatCard } from './stat-card'

/**
 * Native platform-admin overview. Only mounted for accounts where
 * `isAdministrator` is true; the server still guards the endpoint.
 */
export function SystemOverview({ userId }: { userId: string }) {
  const dashboard = useQuery(systemDashboardQueryOptions(userId))
  const months = dashboard.data?.months ?? []
  const labels = months.map((month) => monthLabel(month.month))
  const range = monthRangeLabel(months.map((month) => month.month))
  const users = months.map((month) => month.users)
  const organizations = months.map((month) => month.organizations)
  const sales = months.map((month) => month.sales)
  const purchases = months.map((month) => month.purchases)
  const newUsers = users.reduce((sum, value) => sum + value, 0)
  const newOrganizations = organizations.reduce((sum, value) => sum + value, 0)
  const totalSales = sales.reduce((sum, value) => sum + value, 0)
  const totalPurchases = purchases.reduce((sum, value) => sum + value, 0)

  return (
    <section aria-labelledby='platform-activity-heading' className='space-y-4'>
      <div>
        <h2 id='platform-activity-heading' className='text-xl font-semibold'>
          {t('dashboard:systemOverview.heading')}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {t('dashboard:systemOverview.description')}
        </p>
      </div>
      {dashboard.isPending ? (
        <p role='status'>{t('dashboard:systemOverview.loading')}</p>
      ) : null}
      {dashboard.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            {t('dashboard:systemOverview.error')}{' '}
            {errorMessage(dashboard.error)}
          </p>
          <Button variant='outline' onClick={() => void dashboard.refetch()}>
            {t('dashboard:common.retry')}
          </Button>
        </div>
      ) : null}
      {dashboard.isSuccess ? (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              label={t('dashboard:systemOverview.statUsers')}
              value={dashboard.data.totals.users}
              description={t('dashboard:systemOverview.statUsersDescription')}
            />
            <StatCard
              label={t('dashboard:systemOverview.statOrganizations')}
              value={dashboard.data.totals.organizations}
              description={t(
                'dashboard:systemOverview.statOrganizationsDescription'
              )}
            />
            <StatCard
              label={t('dashboard:systemOverview.statSales')}
              value={dashboard.data.totals.sales}
              description={t('dashboard:systemOverview.statSalesDescription')}
            />
            <StatCard
              label={t('dashboard:systemOverview.statPurchases')}
              value={dashboard.data.totals.purchases}
              description={t(
                'dashboard:systemOverview.statPurchasesDescription'
              )}
            />
          </div>
          <div className='grid gap-4 lg:grid-cols-2'>
            <ActivityChart
              title={t('dashboard:systemOverview.userChartTitle')}
              description={
                range
                  ? t('dashboard:systemOverview.userChartDescription', {
                      range,
                      users: formatCount(newUsers),
                      organizations: formatCount(newOrganizations),
                    })
                  : t('dashboard:systemOverview.userChartDescriptionNoRange', {
                      users: formatCount(newUsers),
                      organizations: formatCount(newOrganizations),
                    })
              }
              monthLabels={labels}
              series={[
                {
                  key: 'users',
                  label: t('dashboard:systemOverview.userSeries'),
                  color: 'var(--chart-1)',
                  values: users,
                },
                {
                  key: 'organizations',
                  label: t('dashboard:systemOverview.organizationSeries'),
                  color: 'var(--chart-2)',
                  values: organizations,
                },
              ]}
              emptyMessage={
                range
                  ? t('dashboard:systemOverview.userChartEmpty', { range })
                  : t('dashboard:systemOverview.userChartEmptyNoRange')
              }
            />
            <ActivityChart
              title={t('dashboard:systemOverview.salesChartTitle')}
              description={
                range
                  ? t('dashboard:systemOverview.salesChartDescription', {
                      range,
                      sales: formatCount(totalSales),
                      purchases: formatCount(totalPurchases),
                    })
                  : t('dashboard:systemOverview.salesChartDescriptionNoRange', {
                      sales: formatCount(totalSales),
                      purchases: formatCount(totalPurchases),
                    })
              }
              monthLabels={labels}
              series={[
                {
                  key: 'sales',
                  label: t('dashboard:systemOverview.salesSeries'),
                  color: 'var(--chart-3)',
                  values: sales,
                },
                {
                  key: 'purchases',
                  label: t('dashboard:systemOverview.purchaseSeries'),
                  color: 'var(--chart-4)',
                  values: purchases,
                },
              ]}
              emptyMessage={
                range
                  ? t('dashboard:systemOverview.salesChartEmpty', { range })
                  : t('dashboard:systemOverview.salesChartEmptyNoRange')
              }
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
