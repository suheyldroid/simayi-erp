import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { NavGroup } from './nav-group'
import { type NavGroup as NavGroupData } from './types'

/**
 * System sidebar. It owns the global account session only: no organization
 * switcher and no organization groups. The shell layout is fixed: the standard
 * sidebar variant, expanded by default, collapsible to icons only through the
 * ephemeral per-mount toggle.
 */
export function SystemSidebar({ groups }: { groups: NavGroupData[] }) {
  return (
    <Sidebar collapsible='icon' variant='sidebar'>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <NavGroup key={group.title} {...group} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
