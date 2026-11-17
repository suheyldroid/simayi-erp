import { createFileRoute } from '@tanstack/react-router'
import { setActiveBranch } from '@/lib/branch-scope'
import { OrganizationWorkspaceLayout } from '@/components/layout/organization-workspace-layout'

/**
 * Company workspace shell. It is the same shared shell as the branch mirror, so
 * only one SidebarProvider/header tree can ever mount.
 *
 * Entering this route publishes the company scope to the transport/cache layer.
 * A branch navigation never re-runs it (the branch shell is a different route),
 * so a verified branch can never be replaced by a company scope mid-flight.
 */
export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace'
)({
  beforeLoad: ({ preload, abortController }) => {
    if (preload || abortController.signal.aborted) return
    setActiveBranch(null)
  },
  component: OrganizationWorkspaceLayout,
})
