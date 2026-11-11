import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { OrganizationSwitcher } from '@/features/organization/organization-switcher'
import { AppTitle } from './app-title'
import { NavGroup } from './nav-group'
import { type NavGroup as NavGroupData } from './types'

/**
 * Organization workspace sidebar. Mounted only inside the slug boundary, so the
 * switcher and business links can never appear on a system page. The shell
 * layout is fixed: standard sidebar variant, expanded by default.
 */
export function AppSidebar({ groups }: { groups: NavGroupData[] }) {
  return (
    <Sidebar collapsible='icon' variant='sidebar'>
      <SidebarHeader>
        <AppTitle />
        <OrganizationSwitcher />
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
