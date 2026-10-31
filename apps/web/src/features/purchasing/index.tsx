import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import { OrdersPanel } from './components/orders-panel'

export function PurchasingPage() {
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canView = hasPermission(effective, 'purchase_order', 'view')
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Purchasing</h1>
          <p className='text-muted-foreground'>
            Purchase orders, supplier lines, and receipts into stock.
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
          <p role='alert'>The purchase order view permission is required.</p>
        )}
        {effective && canView && <OrdersPanel permissions={effective} />}
      </Main>
    </>
  )
}
