import { Outlet, useLocation } from '@tanstack/react-router'
import { branchOutletKey, useOptionalBranch } from '@/lib/branch-boundary'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { useOrganizationSidebarNav } from '@/hooks/use-sidebar-nav'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { CommandMenu } from '@/components/command-menu'
import { SkipToMain } from '@/components/skip-to-main'
import { AppSidebar } from './app-sidebar'
import { organizationShellContentClassName } from './organization-shell-classes'
import { useShellReset } from './use-shell-reset'

/** Routes whose pages, sheets and drafts belong to one branch. */
const branchOperationalPrefixes = [
  'stock',
  'purchasing',
  'sales',
  'pos-devices',
] as const

/**
 * Organization workspace shell, mounted by the company route
 * (`/o/<slug>`) and the branch route (`/o/<slug>/b/<uuid>`) alike. Renders the
 * business sidebar, the company or branch switcher and the command menu for
 * overview, suppliers, stock, purchasing and sales. The slug boundary above has
 * already verified membership and the active session; the branch boundary has
 * verified the branch UUID for this company.
 *
 * Branch-operational pages are keyed by company + branch so they remount when
 * the outlet key changes, which keeps branch-scoped pages, sheets and drafts
 * apart. The key is only a remount hint inside the current route match: company
 * and branch paths are different route matches, so it cannot promise that a
 * component's local state survives a scope switch. Screens with unsaved editor
 * state (dashboard builder) own an explicit navigation guard for that.
 */
export function OrganizationWorkspaceLayout() {
  const { organizationId, organizationSlug } = useOrganizationBoundary()
  const branch = useOptionalBranch()
  const branchUuid = branch?.branchUuid ?? null
  const pathname = useLocation({ select: (location) => location.pathname })
  const outletKey = branchOutletKey({
    organizationId,
    organizationSlug,
    pathname,
    branchUuid,
    prefixes: branchOperationalPrefixes,
  })
  const groups = useOrganizationSidebarNav(organizationSlug, branchUuid)
  // Ephemeral UI state must not leak into the sibling settings shell or the
  // next branch selection.
  useShellReset(`${organizationSlug}:${branchUuid ?? 'company'}`)
  return (
    <SidebarProvider>
      <SkipToMain />
      <AppSidebar groups={groups} />
      <SidebarInset className={organizationShellContentClassName}>
        <Outlet key={outletKey} />
      </SidebarInset>
      <CommandMenu groups={groups} />
    </SidebarProvider>
  )
}
