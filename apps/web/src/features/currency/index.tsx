import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import { BackendsPanel } from './components/backends-panel'
import { ConverterPanel, CurrencyCatalog } from './components/converter-panel'

export function Currency() {
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canView = hasPermission(effective, 'admin', 'view')
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Currency</h1>
          <p className='text-muted-foreground'>
            Exchange providers, rate snapshots, and exact decimal conversion.
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
            The admin.view business permission is required for currency
            management.
          </p>
        )}
        {effective && canView && (
          <Tabs defaultValue='backends'>
            <TabsList>
              <TabsTrigger value='backends'>Backends / rates</TabsTrigger>
              <TabsTrigger value='convert'>Convert</TabsTrigger>
              <TabsTrigger value='catalog'>Currencies</TabsTrigger>
            </TabsList>
            <TabsContent value='backends'>
              <BackendsPanel effective={effective} />
            </TabsContent>
            <TabsContent value='convert'>
              <ConverterPanel />
            </TabsContent>
            <TabsContent value='catalog'>
              <CurrencyCatalog />
            </TabsContent>
          </Tabs>
        )}
      </Main>
    </>
  )
}
