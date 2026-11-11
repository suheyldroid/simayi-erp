import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { OrdersDirectory } from './components/orders-directory'

export function PurchasingPage() {
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Purchasing</h1>
          <p className='text-muted-foreground'>
            Purchase orders, item lines, and receipts into stock. Open an order
            to manage its lines, extras, status, and receipts.
          </p>
        </div>
        <OrdersDirectory />
      </Main>
    </>
  )
}
