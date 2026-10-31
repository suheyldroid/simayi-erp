import { useQuery } from '@tanstack/react-query'
import { sessionQuery } from '@/lib/auth'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { permissionsQuery } from '@/features/users/access-api'
import { hasPermission } from '@/features/users/access-model'
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { data: user } = useQuery(sessionQuery)
  const permissions = useQuery(permissionsQuery)
  const groups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.scope || hasPermission(permissions.data, item.scope, 'view')
      ),
    }))
    .filter((group) => group.items.length > 0)
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />

        {/* Replace <TeamSwitch /> with the following <AppTitle />
         /* if you want to use the normal app title instead of TeamSwitch dropdown */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <NavGroup key={group.title} {...group} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? '',
            email: user?.email ?? '',
            avatar: user?.image ?? '',
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
