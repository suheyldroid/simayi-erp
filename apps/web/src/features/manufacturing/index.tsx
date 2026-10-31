import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import { BuildsPanel } from './components/builds-panel'

export function ManufacturingPage() {
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canView = hasPermission(effective, 'build', 'view')
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Manufacturing</h1>
          <p className='text-muted-foreground'>
            Build orders, stock allocation, consumption, and output stock.
          </p>
        </div>
        {permissions.isPending && <p role='status'>Loading permissions…</p>}
        {permissions.isError && (
          <div role='alert'>
            Could not load permissions.{' '}
            <Button
              variant='outline'
              onClick={() => void permissions.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {effective && !canView && (
          <p role='alert'>The build view permission is required.</p>
        )}
        {effective && canView && <BuildsPanel permissions={effective} />}
      </Main>
    </>
  )
}
