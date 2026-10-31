import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import { CategoriesPanel } from './components/categories-panel'
import { PartsPanel } from './components/parts-panel'
import { TemplatesPanel } from './components/templates-panel'

export function PartsCatalog() {
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canViewParts = hasPermission(effective, 'part', 'view')
  const canViewCategories = hasPermission(effective, 'part_category', 'view')
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Parts</h1>
          <p className='text-muted-foreground'>
            Categories, parts, variants, revisions, and part parameters.
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
        {permissions.isSuccess && !canViewParts && !canViewCategories && (
          <p>You do not have access to the part catalog.</p>
        )}
        {(canViewParts || canViewCategories) && (
          <Tabs defaultValue={canViewParts ? 'parts' : 'categories'}>
            <TabsList>
              {canViewParts && <TabsTrigger value='parts'>Parts</TabsTrigger>}
              {canViewCategories && (
                <TabsTrigger value='categories'>Categories</TabsTrigger>
              )}
              {canViewParts && (
                <TabsTrigger value='templates'>Parameter templates</TabsTrigger>
              )}
            </TabsList>
            {canViewParts && (
              <TabsContent value='parts'>
                <PartsPanel permissions={effective} />
              </TabsContent>
            )}
            {canViewCategories && (
              <TabsContent value='categories'>
                <CategoriesPanel permissions={effective} />
              </TabsContent>
            )}
            {canViewParts && (
              <TabsContent value='templates'>
                <TemplatesPanel permissions={effective} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </Main>
    </>
  )
}
