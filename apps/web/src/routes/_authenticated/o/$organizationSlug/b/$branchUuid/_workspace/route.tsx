import { createFileRoute } from '@tanstack/react-router'
import { OrganizationWorkspaceLayout } from '@/components/layout/organization-workspace-layout'

/**
 * Branch workspace shell. It is the same shared shell as the company route, so
 * only one SidebarProvider/header tree can ever mount.
 */
export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace'
)({
  component: OrganizationWorkspaceLayout,
})
