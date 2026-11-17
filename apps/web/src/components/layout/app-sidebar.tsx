import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { BranchSwitcher } from '@/features/branches/branch-switcher'
import { AppTitle } from './app-title'
import { NavGroup } from './nav-group'
import { type NavGroup as NavGroupData } from './types'

/**
 * Organization workspace sidebar. Mounted only inside the slug boundary, so the
 * business links can never appear on a system page. The shell layout is fixed:
 * standard sidebar variant, expanded by default.
 *
 * The path already names the company (and the branch, when present), so the
 * sidebar offers no organization chooser in either scope. The header keeps the
 * app title and the branch selector, whose company option is the explicit way
 * back to the company path. There is never a second sidebar or a second
 * provider.
 */
export function AppSidebar({ groups }: { groups: NavGroupData[] }) {
  return (
    <Sidebar collapsible='icon' variant='sidebar'>
      <SidebarHeader>
        <AppTitle />
        <BranchSwitcher />
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
