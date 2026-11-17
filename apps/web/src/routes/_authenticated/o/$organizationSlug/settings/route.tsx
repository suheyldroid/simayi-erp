import { createFileRoute } from '@tanstack/react-router'
import { setActiveBranch } from '@/lib/branch-scope'
import { OrganizationSettingsLayout } from '@/components/layout/organization-settings-layout'

/**
 * Company settings shell. Shares the settings frame with the branch mirror; no
 * organization chooser is added here, the workspace sidebar keeps it.
 *
 * Entering this route publishes the company scope to the transport/cache layer.
 * The branch settings shell is a different route, so its branch scope is never
 * overwritten by a parent re-run.
 */
export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings'
)({
  beforeLoad: ({ preload, abortController }) => {
    if (preload || abortController.signal.aborted) return
    setActiveBranch(null)
  },
  component: OrganizationSettingsLayout,
})
