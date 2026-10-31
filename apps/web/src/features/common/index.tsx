import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
import {
  ModelTypesPanel,
  ProjectsPanel,
  StatusesPanel,
  UnitsPanel,
} from './components/catalog-panels'
import { SettingsPanel } from './components/settings-panel'

export function Common() {
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
          <h1 className='text-2xl font-bold'>Common foundation</h1>
          <p className='text-muted-foreground'>
            Preferences, system settings, physical units, custom statuses,
            project codes, and model types.
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
        {effective && (
          <Tabs defaultValue='personal' key={String(canView)}>
            <TabsList className='h-auto flex-wrap'>
              <TabsTrigger value='personal'>My preferences</TabsTrigger>
              {canView && (
                <>
                  <TabsTrigger value='system'>System</TabsTrigger>
                  <TabsTrigger value='units'>Units</TabsTrigger>
                  <TabsTrigger value='statuses'>Statuses</TabsTrigger>
                  <TabsTrigger value='projects'>Projects</TabsTrigger>
                  <TabsTrigger value='models'>Model types</TabsTrigger>
                </>
              )}
            </TabsList>
            <TabsContent value='personal'>
              <SettingsPanel personal canEdit />
            </TabsContent>
            {canView && (
              <>
                <TabsContent value='system'>
                  <SettingsPanel
                    personal={false}
                    canEdit={hasPermission(effective, 'admin', 'change')}
                  />
                </TabsContent>
                <TabsContent value='units'>
                  <UnitsPanel effective={effective} />
                </TabsContent>
                <TabsContent value='statuses'>
                  <StatusesPanel effective={effective} />
                </TabsContent>
                <TabsContent value='projects'>
                  <ProjectsPanel effective={effective} />
                </TabsContent>
                <TabsContent value='models'>
                  <ModelTypesPanel effective={effective} />
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </Main>
    </>
  )
}
