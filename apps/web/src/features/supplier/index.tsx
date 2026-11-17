import { t } from '@/lib/i18n'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { SupplierDirectory } from './components/supplier-directory'

export function Suppliers() {
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>
            {t('operations:supplier.index.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('operations:supplier.index.description')}
          </p>
        </div>
        <SupplierDirectory />
      </Main>
    </>
  )
}
