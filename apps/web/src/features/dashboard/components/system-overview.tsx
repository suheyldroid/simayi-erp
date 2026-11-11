import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { errorMessage } from '../api'
import { monthLabel, monthRangeLabel } from '../format'
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
  const scope = range ? `, ${range}` : ' in the last six months'

  return (
    <section aria-labelledby='platform-activity-heading' className='space-y-4'>
      <div>
        <h2 id='platform-activity-heading' className='text-xl font-semibold'>
          Platform activity
        </h2>
        <p className='text-sm text-muted-foreground'>
          Totals cover all time. Charts count records created in each of the
          last six UTC months.
        </p>
      </div>
      {dashboard.isPending ? (
        <p role='status'>Loading platform activity…</p>
      ) : null}
      {dashboard.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            Could not load platform activity. {errorMessage(dashboard.error)}
          </p>
          <Button variant='outline' onClick={() => void dashboard.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {dashboard.isSuccess ? (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              label='Users'
              value={dashboard.data.totals.users}
              description='All-time platform accounts'
            />
            <StatCard
              label='Organizations'
              value={dashboard.data.totals.organizations}
              description='All-time organizations'
            />
            <StatCard
              label='Sales'
              value={dashboard.data.totals.sales}
              description='All-time recorded sales'
            />
            <StatCard
              label='Purchase orders'
              value={dashboard.data.totals.purchases}
              description='All-time purchase orders, all statuses'
            />
          </div>
          <div className='grid gap-4 lg:grid-cols-2'>
            <ActivityChart
              title='New users and organizations'
              description={`New accounts and organizations created per month${
                range ? `, ${range}` : ''
              }. ${newUsers} new users and ${newOrganizations} new organizations in this period.`}
              monthLabels={labels}
              series={[
                {
                  key: 'users',
                  label: 'New users',
                  color: 'var(--chart-1)',
                  values: users,
                },
                {
                  key: 'organizations',
                  label: 'New organizations',
                  color: 'var(--chart-2)',
                  values: organizations,
                },
              ]}
              emptyMessage={`No new users or organizations were created${scope}.`}
            />
            <ActivityChart
              title='Sales and purchase orders'
              description={`Sales and purchase orders created per month${
                range ? `, ${range}` : ''
              }. ${totalSales} sales and ${totalPurchases} purchase orders in this period.`}
              monthLabels={labels}
              series={[
                {
                  key: 'sales',
                  label: 'Sales',
                  color: 'var(--chart-3)',
                  values: sales,
                },
                {
                  key: 'purchases',
                  label: 'Purchase orders',
                  color: 'var(--chart-4)',
                  values: purchases,
                },
              ]}
              emptyMessage={`No sales or purchase orders were created${scope}.`}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
