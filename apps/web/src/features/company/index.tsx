import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import { CompanyDirectory } from './components/company-directory'

export function Companies() {
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canView =
    hasPermission(effective, 'purchase_order', 'view') ||
    hasPermission(effective, 'sales_order', 'view')
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Companies</h1>
          <p className='text-muted-foreground'>
            Customers, suppliers, and manufacturers, with contacts and
            addresses.
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
          <p role='alert'>
            Purchase order or sales order view permission is required for
            companies.
          </p>
        )}
        {effective && canView && <CompanyDirectory effective={effective} />}
      </Main>
    </>
  )
}
