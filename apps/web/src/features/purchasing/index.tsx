import { t } from '@/lib/i18n'
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
          <h1 className='text-2xl font-bold'>
            {t('operations:purchasing.index.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('operations:purchasing.index.description')}
          </p>
        </div>
        <OrdersDirectory />
      </Main>
    </>
  )
}
