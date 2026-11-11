import { Outlet } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { CommandMenu } from '@/components/command-menu'
import { systemSidebarData } from '@/components/layout/data/sidebar-data'
import { SkipToMain } from '@/components/skip-to-main'
import { SystemSidebar } from './system-sidebar'

/**
 * System layer shell. It renders global navigation only and never reads tenant
 * data, even when the account has an active organization. System pages must be
 * reachable without clearing the active organization.
 *
 * `children` lets the organization settings adapter reuse the exact same global
 * shell for its own frame; route pages keep using the outlet.
 */
export function SystemLayout({ children }: { children?: React.ReactNode }) {
  const groups = systemSidebarData.navGroups
  return (
    <SidebarProvider>
      <SkipToMain />
      <SystemSidebar groups={groups} />
      <SidebarInset
        className={cn(
          // Set content container, so we can use container queries
          '@container/content',

          // The shell layout is fixed: a fixed page height keeps the
          // scrollable main area inside the viewport instead of overflowing.
          'has-data-[layout=fixed]:h-svh'
        )}
      >
        {children ?? <Outlet />}
      </SidebarInset>
      <CommandMenu groups={groups} />
    </SidebarProvider>
  )
}
