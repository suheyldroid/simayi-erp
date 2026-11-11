import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage } from '../api'
import { personalDashboardQueryOptions } from '../queries'
import { StatCard } from './stat-card'

/**
 * Current-account summary for non-admin users. Every value comes from the
 * membership-scoped `/dashboard/personal` aggregate; the active organization
 * is never read or changed here.
 */
export function PersonalOverview({
  userId,
  membershipKey,
  membershipsResolved,
}: {
  userId: string
  membershipKey: string
  membershipsResolved: boolean
}) {
  const dashboard = useQuery(
    personalDashboardQueryOptions(userId, membershipKey, membershipsResolved)
  )
  const totals = dashboard.data?.totals
  const alerts = dashboard.data?.alerts

  return (
    <section aria-labelledby='personal-summary-heading' className='space-y-6'>
      <div>
        <h2 id='personal-summary-heading' className='text-xl font-semibold'>
          Your business summary
        </h2>
        <p className='text-sm text-muted-foreground'>
          All-time totals across every organization you belong to. Reading this
          dashboard never changes your active organization.
        </p>
      </div>
      {dashboard.isPending ? (
        <p role='status'>Loading your business summary…</p>
      ) : null}
      {dashboard.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            Could not load your business summary.{' '}
            {errorMessage(dashboard.error)}
          </p>
          <Button variant='outline' onClick={() => void dashboard.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {dashboard.isSuccess && totals && alerts ? (
        <>
          <div className='grid gap-4 sm:grid-cols-2'>
            <StatCard
              label='Sales'
              value={totals.sales}
              description='All-time recorded sales in your member organizations'
            />
            <StatCard
              label='Purchase orders'
              value={totals.purchases}
              description='All-time purchase orders, every status, in your member organizations'
            />
          </div>
          <div className='space-y-3'>
            <div className='flex flex-wrap items-end justify-between gap-2'>
              <div>
                <h3
                  id='critical-stock-heading'
                  className='text-lg font-semibold'
                >
                  Critical stock alerts
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Active items at or below their minimum stock in any of your
                  organizations.
                </p>
              </div>
              <p className='text-sm text-muted-foreground'>
                {alerts.total === 1
                  ? '1 active alarm'
                  : `${alerts.total} active alarms`}
              </p>
            </div>
            <Card className='gap-0 rounded-md py-0 shadow-none'>
              <CardContent className='px-4 py-2'>
                {alerts.total === 0 ? (
                  <p className='py-3 text-sm text-muted-foreground'>
                    No critical stock alarms. Every active item is above its
                    minimum stock.
                  </p>
                ) : (
                  <>
                    {alerts.items.length > 0 ? (
                      <ul
                        aria-labelledby='critical-stock-heading'
                        className='divide-y divide-border'
                      >
                        {alerts.items.map((item) => (
                          <li
                            key={item.uuid}
                            className='flex flex-wrap items-start justify-between gap-3 py-3'
                          >
                            <div className='min-w-0 space-y-1'>
                              <p className='font-medium break-words'>
                                {item.name}
                                {item.ipn ? (
                                  <span className='ms-2 text-xs font-normal text-muted-foreground'>
                                    IPN {item.ipn}
                                  </span>
                                ) : null}
                              </p>
                              <p className='text-sm break-words text-muted-foreground'>
                                {item.organizationName} /{item.organizationSlug}
                              </p>
                              <p className='text-sm'>
                                Stock{' '}
                                <span className='font-medium tabular-nums'>
                                  {item.stock}
                                </span>{' '}
                                / minimum{' '}
                                <span className='font-medium tabular-nums'>
                                  {item.minimumStock}
                                </span>
                                {item.units ? ` ${item.units}` : null}
                              </p>
                            </div>
                            <Link
                              to='/o/$organizationSlug/settings/items/$itemId'
                              params={{
                                organizationSlug: item.organizationSlug,
                                itemId: item.uuid,
                              }}
                              aria-label={`View details for ${item.name} in ${item.organizationName}`}
                              className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                            >
                              Details
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {alerts.items.length < alerts.total ? (
                      <p className='border-t border-border py-2 text-xs text-muted-foreground'>
                        Showing {alerts.items.length} of {alerts.total} critical
                        stock items.
                      </p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  )
}
