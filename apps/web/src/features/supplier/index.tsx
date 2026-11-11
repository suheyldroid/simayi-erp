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
          <h1 className='text-2xl font-bold'>Suppliers</h1>
          <p className='text-muted-foreground'>
            Supplier contact details and the primary delivery address.
          </p>
        </div>
        <SupplierDirectory />
      </Main>
    </>
  )
}
