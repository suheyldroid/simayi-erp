import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage } from '../api'
import { personalDashboardQueryOptions } from '../queries'

/**
 * Bounded low-stock alert list across current native memberships. Business
 * counts are intentionally absent: the customizable dashboard owns the KPI
 * cards, while this section keeps the detailed critical-stock capability.
 */
export function CriticalStockAlerts({
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
  const alerts = dashboard.data?.alerts

  return (
    <section aria-labelledby='critical-stock-heading' className='space-y-3'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 id='critical-stock-heading' className='text-xl font-semibold'>
            Critical stock alerts
          </h2>
          <p className='text-sm text-muted-foreground'>
            Active items at or below their minimum stock in any of your
            organizations.
          </p>
        </div>
        {alerts ? (
          <p className='text-sm text-muted-foreground'>
            {alerts.total === 1
              ? '1 active alarm'
              : `${alerts.total} active alarms`}
          </p>
        ) : null}
      </div>
      {dashboard.isPending ? (
        <p role='status'>Loading critical stock alerts…</p>
      ) : null}
      {dashboard.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            Could not load critical stock alerts.{' '}
            {errorMessage(dashboard.error)}
          </p>
          <Button variant='outline' onClick={() => void dashboard.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {alerts ? (
        <Card className='gap-0 rounded-md py-0 shadow-none'>
          <CardContent className='px-4 py-2'>
            {alerts.total === 0 ? (
              <p className='py-3 text-sm text-muted-foreground'>
                No critical stock alarms. Every active item is above its minimum
                stock.
              </p>
            ) : (
              <>
                {alerts.items.length > 0 ? (
                  <ul className='divide-y divide-border'>
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
      ) : null}
    </section>
  )
}
