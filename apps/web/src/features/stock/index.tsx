import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import { ItemsPanel } from './components/items-panel'
import { LocationTypesPanel } from './components/location-types-panel'
import { LocationsPanel } from './components/locations-panel'

export function StockLocations() {
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canViewLocations = hasPermission(effective, 'stock_location', 'view')
  const canViewItems = hasPermission(effective, 'stock', 'view')
  const defaultTab = canViewLocations ? 'locations' : 'items'
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Stock</h1>
          <p className='text-muted-foreground'>
            Stock items, serial and batch tracking, counts, history, and
            warehouse locations.
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
        {effective && !canViewLocations && !canViewItems && (
          <p role='alert'>
            The stock or stock location view permission is required.
          </p>
        )}
        {effective && (canViewLocations || canViewItems) && (
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              {canViewLocations && (
                <TabsTrigger value='locations'>Locations</TabsTrigger>
              )}
              {canViewLocations && (
                <TabsTrigger value='types'>Location types</TabsTrigger>
              )}
              {canViewItems && <TabsTrigger value='items'>Items</TabsTrigger>}
            </TabsList>
            {canViewLocations && (
              <TabsContent value='locations'>
                <LocationsPanel effective={effective} />
              </TabsContent>
            )}
            {canViewLocations && (
              <TabsContent value='types'>
                <LocationTypesPanel effective={effective} />
              </TabsContent>
            )}
            {canViewItems && (
              <TabsContent value='items'>
                <ItemsPanel permissions={effective} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </Main>
    </>
  )
}
