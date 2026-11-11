import { Outlet } from '@tanstack/react-router'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { useOrganizationSidebarNav } from '@/hooks/use-sidebar-nav'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { CommandMenu } from '@/components/command-menu'
import { SkipToMain } from '@/components/skip-to-main'
import { AppSidebar } from './app-sidebar'
import { organizationShellContentClassName } from './organization-shell-classes'
import { useShellReset } from './use-shell-reset'

/**
 * Organization workspace shell. Renders the business sidebar, switcher and
 * command menu for overview, suppliers, stock, purchasing and sales. The
 * slug boundary above has already verified membership and the active session.
 */
export function OrganizationWorkspaceLayout() {
  const { organizationId, organizationSlug } = useOrganizationBoundary()
  const groups = useOrganizationSidebarNav(organizationSlug)
  // Ephemeral UI state must not leak into the sibling settings shell.
  useShellReset(organizationSlug)
  return (
    <SidebarProvider>
      <SkipToMain />
      <AppSidebar groups={groups} />
      <SidebarInset className={organizationShellContentClassName}>
        <Outlet key={organizationId} />
      </SidebarInset>
      <CommandMenu groups={groups} />
    </SidebarProvider>
  )
}
