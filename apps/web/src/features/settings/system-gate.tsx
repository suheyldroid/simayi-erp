import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * Nested platform administration gate for the system category of settings.
 * Nothing below it mounts for a non-administrator, a pending session or a
 * failed session read, so the users, units and currency management queries
 * never start.
 */
export function SystemSettingsGate() {
  const session = useQuery(sessionQuery)

  if (session.isPending)
    return <p role='status'>{t('global:shared.accountLoading')}</p>

  if (session.isError)
    return (
      <div role='alert' className='space-y-2'>
        <p>{t('global:shared.accountLoadFailed')}</p>
        <Button variant='outline' onClick={() => void session.refetch()}>
          {t('global:shared.retry')}
        </Button>
      </div>
    )

  if (!isAdministrator(session.data?.user))
    return (
      <p className='text-muted-foreground'>
        {t('global:settings.gate.adminRequired')}
      </p>
    )

  return <Outlet />
}
